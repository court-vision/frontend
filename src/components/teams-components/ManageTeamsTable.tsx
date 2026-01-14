import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
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
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil } from "lucide-react";
import {
  Form,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
  FormItem,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useTeams } from "@/app/context/TeamsContext";
import {
  useAddTeamMutation,
  useDeleteTeamMutation,
  useUpdateTeamMutation,
} from "@/hooks/useTeams";
import { DialogClose } from "@radix-ui/react-dialog";
import { toast } from "sonner";

interface TeamInfo {
  team_name: string;
  league_name?: string | null;
  league_id: number;
  year: number;
  espn_s2?: string | null;
  swid?: string | null;
}

export function ManageTeamsTable() {
  const { teams } = useTeams();

  return (
    <Table className="w-full">
      <TableCaption>Add, delete, or edit teams.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Team Name</TableHead>
          <TableHead>League Name</TableHead>
          <TableHead>League ID</TableHead>
          <TableHead className="text-right w-[50px]">Year</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow key={team.team_id}>
            <TableCell className="font-medium">
              {team.league_info.team_name}
            </TableCell>
            <TableCell>{team.league_info.league_name}</TableCell>
            <TableCell>{team.league_info.league_id}</TableCell>
            <TableCell className="text-right">
              {team.league_info.year}
            </TableCell>
            <TableCell className="flex flex-col gap-1 justify-center sm:flex-row sm:items-center">
              <EditTeamForm
                team_id={team.team_id}
                team_info={team.league_info}
              />
              <DeleteTeamConfirmation team_id={team.team_id} />
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={5}>
            <AddTeamForm />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DeleteTeamConfirmation({ team_id }: { team_id: number }) {
  const { mutate: deleteTeam } = useDeleteTeamMutation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="hover:bg-input">
          <Trash2 size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this team?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="mr-2">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={() => deleteTeam(team_id)} variant="default">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTeamForm() {
  const { mutate: addTeam, isPending } = useAddTeamMutation();

  const leagueInfoSchema = z.object({
    leagueID: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League ID must be a number" }),
    leagueYear: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League Year must be a number" }),
    teamName: z.string().min(1),
    leagueName: z.string().optional(),
    s2: z.string().optional(),
    swid: z.string().optional(),
  });

  const form = useForm<z.infer<typeof leagueInfoSchema>>({
    resolver: zodResolver(leagueInfoSchema),
    defaultValues: {
      leagueID: "",
      leagueYear: "",
      teamName: "",
      s2: "",
      swid: "",
    },
  });
  const reset = form.reset;

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSubmitted(false);
    reset();
  };

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (values: z.infer<typeof leagueInfoSchema>) => {
    setSubmitted(true);

    console.log(values);
    addTeam(
      {
        league_id: parseInt(values.leagueID),
        team_name: values.teamName,
        year: parseInt(values.leagueYear),
        league_name: values.leagueName,
        espn_s2: values.s2,
        swid: values.swid,
      },
      {
        onSettled: () => {
          setSubmitted(false);
          reset();
        },
      }
    );
  };

  return (
    <Dialog>
      <DialogTrigger className="w-full">
        <Button asChild
          variant="outline"
          className="flex justify-start w-full hover:bg-input"
        >
          + Add Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team</DialogTitle>
          <DialogDescription>
            Find your ESPN fantasy basketball league.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="leagueID"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>
                      League ID
                      <span style={{ color: "red" }}> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="leagueYear"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>
                      League Year
                      <span style={{ color: "red" }}> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="YYYY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>
                      Team Name
                      <span style={{ color: "red" }}> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <hr></hr>
            <DialogDescription>For private leagues.</DialogDescription>

            <FormField
              control={form.control}
              name="s2"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>ESPN s2</FormLabel>
                    <FormControl>
                      <Input placeholder="s2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="swid"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>SWID</FormLabel>
                    <FormControl>
                      <Input placeholder="SWID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-between pl-0 pr-0 mb-[-1rem]">
              <Button
                type="button"
                className="size-sm bg-primary"
                onClick={handleClearClick}
              >
                <Image
                  src="/clear.png"
                  alt="clear"
                  width={30}
                  height={30}
                />
              </Button>
              <Button type="submit" className="size-sm bg-primary">
                <Image
                  src="/arrow.png"
                  alt="submit"
                  width={30}
                  height={30}
                />
              </Button>
            </div>
            <div className="text-center justify-center items-center">
              <Skeleton
                className={` ${
                  submitted
                    ? "h-4 mt-5 w-full justify-center items-center"
                    : "hidden"
                }`}
              ></Skeleton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamForm({
  team_id,
  team_info,
}: {
  team_id: number;
  team_info: TeamInfo;
}) {
  const { mutate: editTeam } = useUpdateTeamMutation();

  const leagueInfoSchema = z.object({
    leagueID: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League ID must be a number" }),
    leagueYear: z
      .string()
      .min(1)
      .regex(/^\d+$/, { message: "League Year must be a number" }),
    teamName: z.string().min(1),
    leagueName: z.string().optional(),
    s2: z.string().optional(),
    swid: z.string().optional(),
  });

  const form = useForm<z.infer<typeof leagueInfoSchema>>({
    resolver: zodResolver(leagueInfoSchema),
    defaultValues: {
      leagueID: `${team_info.league_id}`,
      leagueYear: `${team_info.year}`,
      teamName: team_info.team_name,
      leagueName: team_info.league_name || "",
      s2: team_info.espn_s2 || "",
      swid: team_info.swid || "",
    },
  });
  const reset = form.reset;

  const handleClearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSubmitted(false);
    reset();
  };

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (values: z.infer<typeof leagueInfoSchema>) => {
    // Check if the form values have not changed
    if (
      values.leagueID === `${team_info.league_id}` &&
      values.leagueYear === `${team_info.year}` &&
      values.teamName === team_info.team_name &&
      values.leagueName === (team_info.league_name || "") &&
      values.s2 === (team_info.espn_s2 || "") &&
      values.swid === (team_info.swid || "")
    ) {
      toast.error("No edits were made.");
      return;
    }

    setSubmitted(true);

    console.log(values);

    // Edit team
    editTeam(
      {
        teamId: team_id,
        teamData: {
          league_id: parseInt(values.leagueID),
          team_name: values.teamName,
          year: parseInt(values.leagueYear),
          league_name: values.leagueName,
          espn_s2: values.s2,
          swid: values.swid,
        },
      },
      {
        onSettled: () => {
          setSubmitted(false);
        },
      }
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="hover:bg-input ml-[-5px]">
          <Pencil size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Edit the information of your team.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="leagueID"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>League ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`${team_info.league_id}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="leagueYear"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>League Year</FormLabel>
                    <FormControl>
                      <Input placeholder="YYYY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="leagueName"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>League Name</FormLabel>
                    <FormControl>
                      <Input placeholder="League Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <hr></hr>
            <DialogDescription>For private leagues.</DialogDescription>

            <FormField
              control={form.control}
              name="s2"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>ESPN s2</FormLabel>
                    <FormControl>
                      <Input placeholder="s2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="swid"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>SWID</FormLabel>
                    <FormControl>
                      <Input placeholder="SWID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-between pl-0 pr-0 mb-[-1rem]">
              <Button
                type="button"
                className="size-sm bg-primary"
                onClick={handleClearClick}
              >
                <Image
                  src="/clear.png"
                  alt="clear"
                  width={30}
                  height={30}
                />
              </Button>
              <Button type="submit" className="size-sm bg-primary">
                <Image
                  src="/arrow.png"
                  alt="submit"
                  width={30}
                  height={30}
                />
              </Button>
            </div>
            <div className="text-center justify-center items-center">
              <Skeleton
                className={` ${
                  submitted
                    ? "h-4 mt-5 w-full justify-center items-center"
                    : "hidden"
                }`}
              ></Skeleton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
