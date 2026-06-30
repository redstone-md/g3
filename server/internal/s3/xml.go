package s3

import (
	"encoding/xml"
	"io"
	"net/http"
)

func decodeXML(r io.Reader, v any) error {
	return xml.NewDecoder(r).Decode(v)
}

type xmlBucket struct {
	Name         string `xml:"Name"`
	CreationDate string `xml:"CreationDate"`
}

type listAllBuckets struct {
	XMLName xml.Name    `xml:"ListAllMyBucketsResult"`
	Owner   xmlOwner    `xml:"Owner"`
	Buckets []xmlBucket `xml:"Buckets>Bucket"`
}

type xmlOwner struct {
	ID          string `xml:"ID"`
	DisplayName string `xml:"DisplayName"`
}

type xmlObject struct {
	Key          string `xml:"Key"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
	StorageClass string `xml:"StorageClass"`
}

type listBucketResult struct {
	XMLName               xml.Name    `xml:"ListBucketResult"`
	Name                  string      `xml:"Name"`
	Prefix                string      `xml:"Prefix"`
	KeyCount              int         `xml:"KeyCount"`
	MaxKeys               int         `xml:"MaxKeys"`
	IsTruncated           bool        `xml:"IsTruncated"`
	NextContinuationToken string      `xml:"NextContinuationToken,omitempty"`
	Contents              []xmlObject `xml:"Contents"`
}

type initiateMultipartResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadID string   `xml:"UploadId"`
}

type completeMultipartRequest struct {
	XMLName xml.Name `xml:"CompleteMultipartUpload"`
	Parts   []struct {
		PartNumber int    `xml:"PartNumber"`
		ETag       string `xml:"ETag"`
	} `xml:"Part"`
}

type completeMultipartResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
}

type deleteRequest struct {
	XMLName xml.Name `xml:"Delete"`
	Objects []struct {
		Key string `xml:"Key"`
	} `xml:"Object"`
}

type deletedEntry struct {
	Key string `xml:"Key"`
}

type deleteResult struct {
	XMLName xml.Name       `xml:"DeleteResult"`
	Deleted []deletedEntry `xml:"Deleted"`
}

type s3Error struct {
	XMLName   xml.Name `xml:"Error"`
	Code      string   `xml:"Code"`
	Message   string   `xml:"Message"`
	Resource  string   `xml:"Resource"`
	RequestID string   `xml:"RequestId"`
}

func writeXML(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(xml.Header))
	_ = xml.NewEncoder(w).Encode(body)
}

// writeS3Error emits an S3-style XML error with the proper HTTP status.
func writeS3Error(w http.ResponseWriter, status int, code, message, resource string) {
	writeXML(w, status, s3Error{Code: code, Message: message, Resource: resource})
}
