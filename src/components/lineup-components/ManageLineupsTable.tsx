"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Trash2 } from "lucide-react";
import { useLineup } from "@/app/context/LineupContext";
import type { Lineup } from "@/types/lineup";
import { LineupViewer } from "@/components/lineup-components/LineupDisplay";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ManageLineupsTable() {
  const { savedLineups } = useLineup();

  return (
    <Table className="max-w-[100%]">
      <TableCaption>
        View and delete your saved lineups for the selected teams.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="text-left w-[20vw]">Timestamp</TableHead>
          <TableHead className="text-center w-[10vw]">Improvement</TableHead>
          <TableHead className="text-center w-[10vw]">Week</TableHead>
          <TableHead className="text-center w-[10vw]">Streaming Slots</TableHead>
          <TableHead className="text-center w-[8vw]">View</TableHead>
          <TableHead className="text-center w-[8vw]">Delete</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {savedLineups ? (
          <>
            {savedLineups.map((savedLineup) => (
              <TableRow key={savedLineup.Id}>
                <TableCell className="font-medium">
                  {savedLineup.Timestamp}
                </TableCell>
                <TableCell className="text-center">
                  {savedLineup.Improvement}
                </TableCell>
                <TableCell className="text-center">
                  {savedLineup.Week}
                </TableCell>
                <TableCell className="text-center">
                  {savedLineup.StreamingSlots}
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-block">
                    <ViewLineupButton lineup={savedLineup} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-block">
                    {savedLineup.Id !== null && (
                      <DeleteLineupConfirmation team_id={savedLineup.Id} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        ) : (
          <TableRow>
            <TableCell colSpan={6}>
              <p className="text-center text-gray-400">No lineups found.</p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function ViewLineupButton({ lineup }: { lineup: Lineup }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="hover:bg-input">
          <Eye size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/50">
          <DialogTitle className="text-base">
            Week {lineup.Week} Lineup
          </DialogTitle>
          <DialogDescription className="text-xs">
            +{lineup.Improvement} projected improvement
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="p-4">
            <LineupViewer lineup={lineup} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLineupConfirmation({ team_id }: { team_id: number }) {
  const { deleteLineup } = useLineup();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="hover:bg-input mr-[-5px]">
          <Trash2 size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Lineup</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this lineup?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="mr-2">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={() => deleteLineup(team_id)} variant="default">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
