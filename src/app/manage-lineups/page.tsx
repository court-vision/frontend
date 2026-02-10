import { ManageLineupsTable } from "@/components/lineup-components/ManageLineupsTable";

export default function ManageLineups() {
  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Manage Lineups
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          View and manage your saved lineups.
        </p>
      </section>
      <ManageLineupsTable />
    </div>
  );
}
