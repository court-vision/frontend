import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ManageLineupsTable } from "@/components/lineup-components/ManageLineupsTable";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

export default function ManageLineups() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <PageHeader
        title="Manage Lineups"
        subtitle="View and manage your saved lineups."
        actions={
          <Link href="/lineup-generation">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
        }
      />
      <ManageLineupsTable />
    </div>
  );
}
