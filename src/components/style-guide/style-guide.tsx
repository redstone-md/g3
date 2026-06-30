import {
  AlertCircleIcon,
  InformationCircleIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { NotifyDemo } from "@/components/style-guide/notify-demo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const SWATCHES: { name: string; className: string; text: string }[] = [
  { name: "Background", className: "bg-background", text: "text-foreground" },
  { name: "Card", className: "bg-card", text: "text-card-foreground" },
  { name: "Primary", className: "bg-primary", text: "text-primary-foreground" },
  {
    name: "Secondary",
    className: "bg-secondary",
    text: "text-secondary-foreground",
  },
  { name: "Muted", className: "bg-muted", text: "text-muted-foreground" },
  { name: "Accent", className: "bg-accent", text: "text-accent-foreground" },
  { name: "Destructive", className: "bg-destructive", text: "text-white" },
  { name: "Border", className: "bg-border", text: "text-foreground" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StyleGuide() {
  return (
    <div className="grid gap-6">
      <Section
        title="Colors"
        description="Semantic theme tokens in the active (dark) palette."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((s) => (
            <div
              key={s.name}
              className={`flex h-20 flex-col justify-end rounded-lg border border-border/60 p-3 ${s.className} ${s.text}`}
            >
              <span className="text-xs font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Typography"
        description="Figtree for UI, Geist Mono for code."
      >
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Display heading</h1>
          <h2 className="text-2xl font-semibold tracking-tight">
            Section heading
          </h2>
          <h3 className="text-lg font-medium">Subsection heading</h3>
          <p className="text-sm leading-relaxed text-foreground">
            Body copy renders in Figtree. The quick brown fox jumps over the
            lazy dog.
          </p>
          <p className="text-sm text-muted-foreground">
            Muted text for secondary information and hints.
          </p>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            const ribbon = true;
          </code>
        </div>
      </Section>

      <Section title="Buttons" description="Variants and sizes.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button>
            <HugeiconsIcon icon={SparklesIcon} />
            With icon
          </Button>
        </div>
      </Section>

      <Section title="Badges" description="Status and label chips.">
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Form elements" description="Inputs and toggles.">
        <div className="grid max-w-md gap-5">
          <div className="grid gap-2">
            <Label htmlFor="sg-input">Email</Label>
            <Input id="sg-input" type="email" placeholder="you@ribbon.local" />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="sg-check" defaultChecked />
            <Label htmlFor="sg-check">Send me product updates</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="sg-switch" defaultChecked />
            <Label htmlFor="sg-switch">Enable notifications</Label>
          </div>
        </div>
      </Section>

      <Section title="Alerts" description="Inline messaging.">
        <div className="grid gap-3">
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>
              This is an informational message for the operator.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>Your change could not be saved.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section
        title="Notifications"
        description="notify() routes to a toast when visible, or a native OS notification when the tab is hidden."
      >
        <NotifyDemo />
      </Section>

      <Separator />
    </div>
  );
}
