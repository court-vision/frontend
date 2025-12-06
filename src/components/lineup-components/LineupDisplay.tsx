import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SlimGene, SlimPlayer, Lineup } from "@/types/lineup";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { useLineup } from "@/app/context/LineupContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Save } from "lucide-react";

export default function LineupDisplay({ lineup }: { lineup: Lineup }) {
  const { saveLineup } = useLineup();

  const handleSaveLineup = () => {
    saveLineup(lineup);
  };

  return (
    <div className="flex flex-col items-center gap-1 w-3/4">
      {lineup.Lineup.length == 0 ? (
        <h2 className="text-center">
          Enter your threshold for considering a player &quot;streamable&quot;
          and the week you wish to generate a lineup for to get started.
        </h2>
      ) : (
        <div>
          <h1 className="flex items-center text-xl ml-[22px] mb-[-10px] font-bold text-green-500">
            {lineup.Improvement} <TrendingUp size={24} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="h-5 w-5 rounded-full border ml-2 text-sm text-foreground">
                    ?
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-center">
                  <p>
                    How many more points you can expect to score with this
                    lineup compared <br />
                    to your current lineup with no acquisitions made.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              onClick={handleSaveLineup}
              variant="outline"
              className="ml-auto text-foreground flex items-center"
            >
              <Save size={24} />
              <span>Save Lineup</span>
            </Button>
          </h1>
          <div className="w-full overflow-x-auto mt-3">
            <Carousel className="max-w-[1100px] mx-auto">
              <CarouselContent className="max-w-[1100px]">
                {lineup.Lineup.map((gene: SlimGene, index: number) => (
                  <CarouselItem key={index}>
                    <LineupCard gene={gene} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
          <div>
            <p className="text-gray-500 text-sm ml-[22px]">
              * Please be patient, after periods of inactivity the server may
              need to wake up.
              <br />
              * Results will vary across generations so feel free to try again.
              <br />
              <br />
              * Players not playing can go in blank spots, or left on the bench.
              <br />
              * Players marked with a + are new acquisitions to your team.
              <br />
              * Players marked with a - in red are players removed from your
              team.
              <br />* Players marked with a - in grey are players not changed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LineupCard({ gene }: { gene: SlimGene }) {
  const orderToDisplay = [
    "PG",
    "SG",
    "SF",
    "PF",
    "C",
    "G",
    "F",
    "UT1",
    "UT2",
    "UT3",
  ];

  const isPlayerNew = (player: SlimPlayer) => {
    return gene.Additions.some((addition) => addition.Name === player.Name);
  };

  return (
    <Card className="border-none">
      <CardHeader className="text-left my-[-10px]">
        <h1 className="text-xl font-bold">Day {gene.Day + 1}</h1>
        <h2 className="text-sm">Roster:</h2>
      </CardHeader>
      <CardContent className="flex max-w-[1000px] justify-center mb-[-20px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[5px]">Position</TableHead>
              <TableHead className="w-[20px]">Name</TableHead>
              <TableHead className="w-[5px]">Team</TableHead>
              <TableHead className="w-[5px]">Avg Points</TableHead>
              <TableHead className="text-right w-[1px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderToDisplay.map((position: string, index: number) => {
              const player = gene.Roster[position];
              return (
                <>
                  {player ? (
                    <TableRow>
                      <TableCell>{position}</TableCell>
                      <TableCell>{player.Name}</TableCell>
                      <TableCell>{player.Team}</TableCell>
                      <TableCell>{player.AvgPoints}</TableCell>
                      <TableCell className="text-center">
                        {isPlayerNew(player) ? (
                          <span className="text-2xl text-tertiary ">+</span>
                        ) : (
                          <span className="text-2xl text-grey">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell>{position}</TableCell>
                      <TableCell>
                        <Skeleton className="h-4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[50px]" />
                      </TableCell>
                      <TableCell className="flex justify-center">
                        <Skeleton className="h-4 w-[15px]" />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardHeader className="text-left mb-[-15px]">
        <h2 className="text-sm">Removals:</h2>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[75px]">Team</TableHead>
              <TableHead className="w-[75px]">Avg Points</TableHead>
              <TableHead className="text-right w-[15px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gene.Removals.map((player: SlimPlayer, index: number) => (
              <TableRow key={index}>
                <TableCell>{player.Name}</TableCell>
                <TableCell>{player.Team}</TableCell>
                <TableCell>{player.AvgPoints}</TableCell>
                <TableCell className="text-center">
                  <span className="text-2xl text-red-500">-</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// function LineupCard({ gene }: { gene: SlimGene }) {
//   const orderToDisplay = [
//     "PG",
//     "SG",
//     "SF",
//     "PF",
//     "C",
//     "G",
//     "F",
//     "UT1",
//     "UT2",
//     "UT3",
//   ];

//   const isPlayerNew = (player: SlimPlayer) => {
//     return gene.Additions.some((addition) => addition.Name === player.Name);
//   };

//   return (
//     <Card className="border">
//       <CardHeader className="text-center">
//         <h1 className="text-xl">Day {gene.Day + 1}</h1>
//       </CardHeader>
//       <CardContent className="flex justify-center">
//         <div className="flex flex-col gap-1">
//           {orderToDisplay.map((position: string, index: number) => {
//             const player = gene.Roster[position];
//             return (
//               <div className="flex justify-between" key={index}>
//                 {player ? (
//                   <p>
//                     <span className="mr-2">{position}</span>
//                     <span className="mr-2">{player.Name}</span>
//                     <span className="mr-2">{player.Team}</span>
//                     <span className="mr-2">{player.AvgPoints}</span>
//                     <span
//                       className={`${
//                         isPlayerNew(player) ? "text-tertiary" : "hidden"
//                       }`}
//                     >
//                       +
//                     </span>
//                   </p>
//                 ) : (
//                   <div className="flex items-center" key={`skeleton-${index}`}>
//                     <p className="inline-block mr-2">{position}</p>
//                     <Skeleton className="h-4 w-[250px]" />
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//           <div className="flex flex-col justify-between">
//             <div className="flex flex-col gap-1">
//               {gene.Removals.map((player: SlimPlayer, index: number) => (
//                 <div className="flex justify-between" key={index}>
//                   <p>
//                     <span className="mr-2">{player.Name}</span>
//                     <span className="mr-2">{player.Team}</span>
//                     <span className="mr-2">{player.AvgPoints}</span>
//                     <span className="text-primary">-</span>
//                   </p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
