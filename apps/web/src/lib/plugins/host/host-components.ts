import type { HostComponents } from "@kaneo/plugin-sdk/ui";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const hostComponents = {
  Button,
  Badge,
  Input,
  Textarea,
  Label,
  Switch,
  Spinner,
  Skeleton,
  Separator,
  WeekStartControl,
} satisfies HostComponents;
