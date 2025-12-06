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
import { Lineup, SlimGene, useLineup } from "@/app/context/LineupContext";
import { LineupCard } from "@/components/lineup-components/LineupDisplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "../ui/carousel";
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
          <TableHead className="text-center w-[10vw]">Threshold</TableHead>
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
                  {savedLineup.Threshold}
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-block">
                    <ViewLineupButton lineup={savedLineup} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-block">
                    <DeleteLineupConfirmation team_id={savedLineup.Id} />
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
      <DialogTrigger>
        <Button variant="ghost" className="hover:bg-input">
          <Eye size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ScrollArea className="h-[80vh]">
          <Carousel className="w-[75%] max-w-[13.7%] mt-3">
            <CarouselContent>
              {lineup.Lineup.map((gene: SlimGene, index: number) => (
                <CarouselItem key={index}>
                  <LineupCard gene={gene} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLineupConfirmation({ team_id }: { team_id: number }) {
  const { deleteLineup } = useLineup();

  return (
    <Dialog>
      <DialogTrigger>
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
