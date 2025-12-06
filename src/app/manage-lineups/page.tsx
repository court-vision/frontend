import { ManageLineupsTable } from "@/components/lineup-components/ManageLineupsTable";

export default function ManageLineups() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Manage Lineups</h1>
      </div>
      <div className="flex-1 rounded-lg border border-primary border-dashed shadow-sm">
        <div className="flex flex-col gap-1">
          <div>
            <ManageLineupsTable />
          </div>
        </div>
      </div>
    </>
  );
}
