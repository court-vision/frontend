import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ManageLineupsTable } from "@/components/lineup-components/ManageLineupsTable";
import { Button } from "@/components/ui/button";

export default function ManageLineups() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Manage Lineups
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            View and manage your saved lineups.
          </p>
        </div>
        <Link href="/lineup-generation">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        </Link>
      </section>
      <ManageLineupsTable />
    </div>
  );
}
