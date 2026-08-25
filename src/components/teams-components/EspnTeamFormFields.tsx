"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
  FormItem,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { LeagueInfo } from "@/types/team";

export const espnTeamFormSchema = z.object({
  leagueID: z
    .string()
    .min(1, { message: "League ID is required" })
    .regex(/^\d+$/, { message: "League ID must be a number" }),
  leagueYear: z
    .string()
    .min(1, { message: "League year is required" })
    .regex(/^\d{4}$/, { message: "League year must be a 4-digit year" }),
  teamName: z.string().min(1, { message: "Team name is required" }),
  leagueName: z.string().optional(),
  s2: z.string().optional(),
  swid: z.string().optional(),
});

export type EspnTeamFormValues = z.infer<typeof espnTeamFormSchema>;

/** Default values for the form — from an existing team when editing. */
export function espnFormDefaults(info?: Partial<LeagueInfo> | null): EspnTeamFormValues {
  return {
    leagueID: info?.league_id !== undefined ? String(info.league_id) : "",
    leagueYear: info?.year !== undefined ? String(info.year) : "",
    teamName: info?.team_name ?? "",
    leagueName: info?.league_name ?? "",
    s2: info?.espn_s2 ?? "",
    swid: info?.swid ?? "",
  };
}

export const parseCookieString = (
  input: string
): { s2: string; swid: string } | null => {
  const s2Match = input.match(/espn_s2=([^;]+)/);
  const swidMatch = input.match(/SWID=([^;]+)/);

  if (s2Match && swidMatch) {
    return {
      s2: s2Match[1].trim(),
      swid: swidMatch[1].trim(),
    };
  }
  return null;
};

const BOOKMARKLET_CODE = `javascript:(function(){const s2=document.cookie.match(/espn_s2=([^;]+)/);const swid=document.cookie.match(/SWID=([^;]+)/);if(s2&&swid){prompt('Copy these values:','espn_s2='+decodeURIComponent(s2[1])+'; SWID='+decodeURIComponent(swid[1]));}else{alert('Please log into ESPN first.');}})()`;

interface EspnTeamFormFieldsProps {
  form: UseFormReturn<EspnTeamFormValues>;
  /** Show required markers on the mandatory fields (add flow). */
  required?: boolean;
}

function RequiredMark({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-destructive"> *</span>;
}

/**
 * The ESPN league fields shared by the add and edit dialogs: league id/year/
 * team/league name plus the collapsible private-league cookie section.
 */
export function EspnTeamFormFields({ form, required = false }: EspnTeamFormFieldsProps) {
  const [cookieInput, setCookieInput] = useState("");
  const [parseSuccess, setParseSuccess] = useState(false);

  return (
    <>
      <FormField
        control={form.control}
        name="leagueID"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              League ID
              <RequiredMark show={required} />
            </FormLabel>
            <FormControl>
              <Input placeholder="ID" inputMode="numeric" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="leagueYear"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              League Year
              <RequiredMark show={required} />
            </FormLabel>
            <FormControl>
              <Input placeholder="YYYY" inputMode="numeric" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="teamName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Team Name
              <RequiredMark show={required} />
            </FormLabel>
            <FormControl>
              <Input placeholder="Name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="leagueName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>League Name</FormLabel>
            <FormControl>
              <Input placeholder="League Name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <details className="group rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground list-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          <Lock className="h-3.5 w-3.5" />
          <span>Private league settings</span>
          <Badge variant="outline" className="text-[11px] px-1.5 py-0 ml-auto font-normal">
            Optional
          </Badge>
        </summary>

        <div className="flex flex-col gap-3 pt-3">
          <div className="rounded-md border border-dashed p-3 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">
              Step 1: Drag this button to your bookmarks bar:
            </p>
            <div
              dangerouslySetInnerHTML={{
                __html: `<a href="${BOOKMARKLET_CODE}" class="inline-block px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md cursor-grab hover:bg-primary/90" onclick="event.preventDefault()">Get ESPN Cookies</a>`,
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Step 2: Log into ESPN, then click the bookmark and copy the result.
            </p>
          </div>

          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="paste" className="flex-1">
                Paste Cookies
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-3">
              <div className="space-y-2">
                <Label>Paste cookie string</Label>
                <Input
                  placeholder="espn_s2=...; SWID=..."
                  value={cookieInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCookieInput(value);
                    if (!value.trim()) {
                      setParseSuccess(false);
                      return;
                    }
                    const parsed = parseCookieString(value);
                    if (parsed) {
                      form.setValue("s2", parsed.s2, { shouldDirty: true });
                      form.setValue("swid", parsed.swid, { shouldDirty: true });
                      setParseSuccess(true);
                    } else {
                      setParseSuccess(false);
                    }
                  }}
                />
                {parseSuccess && (
                  <div className="text-sm text-status-win space-y-1">
                    <p>Cookies parsed successfully:</p>
                    <p className="font-mono text-xs truncate">
                      espn_s2: {form.getValues("s2")?.slice(0, 20)}...
                    </p>
                    <p className="font-mono text-xs truncate">
                      SWID: {form.getValues("swid")}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-3">
              <FormField
                control={form.control}
                name="s2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ESPN s2</FormLabel>
                    <FormControl>
                      <Input placeholder="s2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="swid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SWID</FormLabel>
                    <FormControl>
                      <Input placeholder="SWID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>
        </div>
      </details>
    </>
  );
}
