"use client";

import React from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IconChartArrowsVertical,
  IconClockHour4,
  IconTrendingUp,
  IconChartPie,
  IconChessKnight,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useMaintenance } from "./context/MaintenanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { isInMaintenance, maintenanceMessage } = useMaintenance();

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Home</h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        {isInMaintenance ? (
          <div className="flex flex-col items-center justify-center p-8 text-center w-full">
            <Card className="w-full max-w-3xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <IconAlertTriangle className="h-8 w-8 text-amber-500" />
                  <span>Maintenance Mode</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl mb-6">{maintenanceMessage}</p>
                <p className="text-muted-foreground">
                  Thank you for using Court Vision. I am currently working on new features
                  and improvements for the next fantasy basketball season. Stay tuned!
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <HomeFeaturesDisplay />
          </div>
        )}
      </div>
    </>
  );
}

function HomeFeaturesDisplay() {
  const features = [
    {
      title: "Advanced tools",
      description:
        "Bringing you insights to help you win your ESPN Points league.",
      icon: <IconChessKnight />,
      page: "/",
    },
    {
      title: "Analyze Your Teams",
      description: "Get a broad snapshot of your teams.",
      icon: <IconChartPie />,
      page: "/your-teams",
    },
    {
      title: "Lineup Generation",
      description: "Optimize your streaming moves for the week.",
      icon: <IconTrendingUp />,
      page: "/lineup-generation",
    },
    {
      title: "Standings",
      description:
        "View the rankings of all fantasy basketball players, updated daily.",
      icon: <IconChartArrowsVertical />,
      page: "/standings",
    },
    {
      title: "Account",
      description: "Login to your account or create an account.",
      icon: <User />,
      page: "/account",
    },
    {
      title: "More Coming Soon",
      description:
        "As a solo developer, I am working hard to bring you more features.",
      icon: <IconClockHour4 />,
      page: "/new-features",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Link href={feature.page} key={feature.title} passHref>
          <Feature key={feature.title} {...feature} index={index} />
        </Link>
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "m-1 flex flex-col rounded-lg border lg:border-r  py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-primary transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
