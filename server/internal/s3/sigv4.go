package s3

import (
	"bufio"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// credential holds the parsed Authorization credential scope.
type credential struct {
	accessKeyID string
	date        string // YYYYMMDD
	region      string
	service     string
	signed      []string
	signature   string
}

// parseAuthorization parses an AWS4-HMAC-SHA256 Authorization header.
func parseAuthorization(header string) (*credential, error) {
	if !strings.HasPrefix(header, "AWS4-HMAC-SHA256 ") {
		return nil, errors.New("unsupported auth scheme")
	}
	parts := strings.Split(strings.TrimPrefix(header, "AWS4-HMAC-SHA256 "), ",")
	c := &credential{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		switch {
		case strings.HasPrefix(p, "Credential="):
			scope := strings.SplitN(strings.TrimPrefix(p, "Credential="), "/", 5)
			if len(scope) != 5 {
				return nil, errors.New("bad credential scope")
			}
			c.accessKeyID, c.date, c.region, c.service = scope[0], scope[1], scope[2], scope[3]
		case strings.HasPrefix(p, "SignedHeaders="):
			c.signed = strings.Split(strings.TrimPrefix(p, "SignedHeaders="), ";")
		case strings.HasPrefix(p, "Signature="):
			c.signature = strings.TrimPrefix(p, "Signature=")
		}
	}
	if c.accessKeyID == "" || c.signature == "" || len(c.signed) == 0 {
		return nil, errors.New("incomplete authorization header")
	}
	return c, nil
}

// verifyV4 recomputes the SigV4 signature using secret and compares it.
func verifyV4(r *http.Request, c *credential, secret string) bool {
	payloadHash := r.Header.Get("X-Amz-Content-Sha256")
	if payloadHash == "" {
		payloadHash = "UNSIGNED-PAYLOAD"
	}
	canonReq := canonicalRequest(r, c.signed, payloadHash, canonicalQuery(r.URL.RawQuery, ""))
	return checkSignature(r.Header.Get("X-Amz-Date"), canonReq, c, secret)
}

func checkSignature(amzDate, canonReq string, c *credential, secret string) bool {
	scope := fmt.Sprintf("%s/%s/%s/aws4_request", c.date, c.region, c.service)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		hashHex([]byte(canonReq)),
	}, "\n")
	signingKey := deriveKey(secret, c.date, c.region, c.service)
	expected := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(c.signature)) == 1
}

// parsePresignedQuery parses SigV4 auth carried in query parameters (presigned
// URLs). Returns false if the request is not a presigned request.
func parsePresignedQuery(q url.Values) (*credential, bool) {
	if q.Get("X-Amz-Algorithm") != "AWS4-HMAC-SHA256" || q.Get("X-Amz-Signature") == "" {
		return nil, false
	}
	scope := strings.SplitN(q.Get("X-Amz-Credential"), "/", 5)
	if len(scope) != 5 {
		return nil, false
	}
	c := &credential{
		accessKeyID: scope[0], date: scope[1], region: scope[2], service: scope[3],
		signed:    strings.Split(q.Get("X-Amz-SignedHeaders"), ";"),
		signature: q.Get("X-Amz-Signature"),
	}
	return c, c.accessKeyID != "" && len(c.signed) > 0
}

// verifyPresigned validates a query-signed (presigned) request and its expiry.
func verifyPresigned(r *http.Request, c *credential, secret string) (ok bool, expired bool) {
	q := r.URL.Query()
	if expiredPresign(q.Get("X-Amz-Date"), q.Get("X-Amz-Expires")) {
		return false, true
	}
	canonReq := canonicalRequest(r, c.signed, "UNSIGNED-PAYLOAD",
		canonicalQuery(r.URL.RawQuery, "X-Amz-Signature"))
	return checkSignature(q.Get("X-Amz-Date"), canonReq, c, secret), false
}

func expiredPresign(amzDate, expires string) bool {
	t, err := time.Parse("20060102T150405Z", amzDate)
	if err != nil {
		return false // can't parse; let signature check decide
	}
	secs, err := strconv.ParseInt(expires, 10, 64)
	if err != nil {
		return false
	}
	return time.Now().UTC().After(t.Add(time.Duration(secs) * time.Second))
}

func canonicalRequest(r *http.Request, signed []string, payloadHash, canonQuery string) string {
	sorted := append([]string{}, signed...)
	sort.Strings(sorted)
	return strings.Join([]string{
		r.Method,
		uriEncode(r.URL.Path, false),
		canonQuery,
		canonicalHeaders(r, sorted),
		strings.Join(sorted, ";"),
		payloadHash,
	}, "\n")
}

func canonicalHeaders(r *http.Request, sorted []string) string {
	var b strings.Builder
	for _, h := range sorted {
		var val string
		if h == "host" {
			val = r.Host
		} else {
			val = r.Header.Get(h)
		}
		b.WriteString(h)
		b.WriteString(":")
		b.WriteString(strings.TrimSpace(val))
		b.WriteString("\n")
	}
	return b.String()
}

// canonicalQuery builds the SigV4 canonical query string, optionally omitting a
// key (presigned URLs exclude X-Amz-Signature from their own signature).
func canonicalQuery(raw, omitKey string) string {
	if raw == "" {
		return ""
	}
	encoded := make([]string, 0)
	for _, p := range strings.Split(raw, "&") {
		k, v, _ := strings.Cut(p, "=")
		if decodeQuery(k) == omitKey {
			continue
		}
		encoded = append(encoded, uriEncode(decodeQuery(k), true)+"="+uriEncode(decodeQuery(v), true))
	}
	sort.Strings(encoded)
	return strings.Join(encoded, "&")
}

// decodeQuery reverses percent-encoding from the raw query so we can re-encode
// it canonically (AWS requires its own normalization).
func decodeQuery(s string) string {
	out := strings.ReplaceAll(s, "+", " ")
	res := make([]byte, 0, len(out))
	for i := 0; i < len(out); i++ {
		if out[i] == '%' && i+2 < len(out) {
			if b, err := strconv.ParseUint(out[i+1:i+3], 16, 8); err == nil {
				res = append(res, byte(b))
				i += 2
				continue
			}
		}
		res = append(res, out[i])
	}
	return string(res)
}

// uriEncode applies AWS's URI encoding rules. When encodeSlash is false, '/'
// is left as-is (used for the canonical path).
func uriEncode(s string, encodeSlash bool) string {
	var b strings.Builder
	for _, c := range []byte(s) {
		switch {
		case (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'),
			c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			b.WriteString(fmt.Sprintf("%%%02X", c))
		}
	}
	return b.String()
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func hashHex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func deriveKey(secret, date, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), date)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

// objectBody returns the real object byte stream, decoding aws-chunked framing
// when the client used the STREAMING signature payload.
func objectBody(r *http.Request) io.Reader {
	if r.Header.Get("X-Amz-Content-Sha256") == "STREAMING-AWS4-HMAC-SHA256-PAYLOAD" {
		return &chunkedReader{br: bufio.NewReader(r.Body)}
	}
	return r.Body
}

// chunkedReader strips aws-chunked framing: each chunk is
//
//	<hex-size>;chunk-signature=<sig>\r\n<data>\r\n
//
// ending with a zero-length chunk. Per-chunk signatures are not re-verified.
type chunkedReader struct {
	br        *bufio.Reader
	remaining int64
	done      bool
}

func (c *chunkedReader) Read(p []byte) (int, error) {
	if c.done {
		return 0, io.EOF
	}
	if c.remaining == 0 {
		line, err := c.br.ReadString('\n')
		if err != nil {
			return 0, err
		}
		sizeHex, _, _ := strings.Cut(strings.TrimSpace(line), ";")
		size, perr := strconv.ParseInt(sizeHex, 16, 64)
		if perr != nil {
			return 0, perr
		}
		if size == 0 {
			c.done = true
			return 0, io.EOF
		}
		c.remaining = size
	}
	if int64(len(p)) > c.remaining {
		p = p[:c.remaining]
	}
	n, err := c.br.Read(p)
	c.remaining -= int64(n)
	if c.remaining == 0 && err == nil {
		// consume the trailing CRLF after the chunk data
		_, _ = c.br.Discard(2)
	}
	return n, err
}
