import React from "react";
import Link from "next/link";
import {
  IconChessKnight,
  IconChartPie,
  IconTrendingUp,
  IconClockHour4,
} from "@tabler/icons-react";
import { User, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NewFeatures() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">
          Potential New Features
        </h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1">
          <FeaturesSectionDemo />
        </div>
      </div>
    </>
  );
}

const Email = () => {
  return <a href="mailto:mail@courtvision.dev?subject=Feature%20Request" />;
};

function FeaturesSectionDemo() {
  const features = [
    {
      title: "Rankings",
      description:
        "Using regression analysis to rank fantasy players in different fantasy formats.",
      icon: <ArrowUpDown />,
    },
    {
      title: "Rising Streamers",
      description: "Identify underrated players who are rostered in a low % of leagues.",
      icon: <IconTrendingUp />,
    },
    {
      title: "Draft Companion",
      description:
        "Draft strategy optimizer using reinforcement learning to guide your draft process.",
      icon: <IconTrendingUp />,
    },
    {
      title: "Suggestions Welcome!",
      description: "Send me an email at mail@courtvision.dev with your feature requests.",
      email: <a href="mailto:mail@courtvision.dev?subject=Feature%20Request" />,
      icon: <User />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  email,
  icon,
  index,
}: {
  title: string;
  description: string;
  email?: React.ReactNode;
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
      <div>
        {email}
			</div>
    </div>
  );
};
