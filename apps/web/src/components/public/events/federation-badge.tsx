import { Badge } from "@bsv-sws/ui/components/form";

/** Marks events organised by the federation itself (colours: --highlight tokens). */
export function FederationBadge() {
  return (
    <Badge className="border-highlight bg-highlight font-semibold text-highlight-foreground">
      BSV-SWS
    </Badge>
  );
}
