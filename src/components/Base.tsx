"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useMaintenance } from "@/app/context/MaintenanceContext";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import Head from "next/head";
import { Menu, Plus, User, Minus, AlertTriangle } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { ModeToggle } from "@/components/ui/toggle-mode";
import { Separator } from "@/components/ui/separator";
import { SkeletonCard } from "@/components/ui/skeleton-card";

import { Roboto } from "next/font/google";
import { TeamDropdown } from "@/components/teams-components/TeamDropdown";
import { useEffect } from "react";

const font = Roboto({
  weight: "900",
  style: "italic",
  subsets: ["latin-ext"],
});
import { FC } from "react";

const Layout: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  const { isInMaintenance } = useMaintenance();
  const pathname = usePathname();
  const router = useRouter();

  // Enforce redirection to home page if site is in maintenance mode
  useEffect(() => {
    if (isInMaintenance && pathname !== "/") {
      router.push("/");
    }
  }, [isInMaintenance, pathname, router]);

  return (
    <>
      <Head>
        <title>Court Vision</title>
        <meta
          name="description"
          content="Court Vision provides advanced tools to help you win your fantasy basketball league."
        />
        <meta
          name="keywords"
          content="fantasy basketball, fantasy sports, lineup optimization, fantasy streaming, fantasy dashboard"
        />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </Head>

      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[200px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
          <div className="flex h-full max-h-screen flex-col gap-2 items-center">
            <div className="flex h-14 items-center border-b px-8 md:h-[120px] lg:h-[120px]">
              <Image src="/logo.png" alt="Logo" width={100} height={100} />
              {isInMaintenance && (
                <AlertTriangle className="h-5 w-5 text-amber-500 ml-2" />
              )}
            </div>
            <div className="flex-1">
              <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                <Link href="/">
                  <div
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                      pathname === "/" ? "text-primary" : ""
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    Home
                  </div>
                </Link>
                {!isInMaintenance && (
                  <>
                    <Link prefetch href="/your-teams">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/your-teams" ? "text-primary" : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Your Teams
                      </div>
                    </Link>
                    <Link prefetch href="/lineup-generation">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/lineup-generation"
                            ? "text-primary"
                            : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Lineup Generation
                      </div>
                    </Link>
                    {(pathname === "/lineup-generation" ||
                      pathname === "/manage-lineups") &&
                      isLoggedIn && (
                        <Link href="/manage-lineups">
                          <div
                            className={`flex items-center gap-3 rounded-lg pl-8 text-xs text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/manage-lineups"
                                ? "text-primary"
                                : ""
                            }`}
                          >
                            <Minus size={10} />
                            Manage Lineups
                          </div>
                        </Link>
                      )}
                    <Link prefetch href="/standings">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/standings" ? "text-primary" : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Standings
                      </div>
                    </Link>
                    <Link prefetch href="/new-features">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/new-features" ? "text-primary" : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        More Coming Soon
                      </div>
                    </Link>
                    <Separator />
                    <Link prefetch href="/account">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/account" ? "text-primary" : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Account
                      </div>
                    </Link>
                    {(pathname === "/account" ||
                      pathname === "/manage-teams") &&
                      isLoggedIn && (
                        <Link href="/manage-teams">
                          <div
                            className={`flex items-center gap-3 rounded-lg pl-8 text-xs text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/manage-teams" ? "text-primary" : ""
                            }`}
                          >
                            <Minus size={10} />
                            Manage Teams
                          </div>
                        </Link>
                      )}
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 items-center border-b bg-muted/40 px-4 md:h-[120px] lg:h-[120px] lg:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-1/2">
                <SheetTrigger asChild>
                  <div className="flex flex-row gap-2 px-4 py-2">
                    {!isLoggedIn && !isInMaintenance && (
                      <Link href="/account">
                        <div className="hover:border-primary">
                          <Button variant="outline">Sign In</Button>
                        </div>
                      </Link>
                    )}
                    {isLoggedIn && !isInMaintenance && <TeamDropdown />}
                  </div>
                </SheetTrigger>
                <nav className="grid gap-2 text-[0.9rem] font-medium">
                  <SheetTrigger asChild>
                    <Link href="/">
                      <div
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          pathname === "/" ? "text-primary" : ""
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        Home
                      </div>
                    </Link>
                  </SheetTrigger>
                  {!isInMaintenance && (
                    <>
                      <SheetTrigger asChild>
                        <Link href="/your-teams">
                          <div
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/teams" ? "text-primary" : ""
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            Your Teams
                          </div>
                        </Link>
                      </SheetTrigger>
                      <SheetTrigger asChild>
                        <Link href="/lineup-generation">
                          <div
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/lineup-generation"
                                ? "text-primary"
                                : ""
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            Lineup Generation
                          </div>
                        </Link>
                      </SheetTrigger>
                      {isLoggedIn && (
                        <SheetTrigger asChild>
                          <Link href="/manage-lineups">
                            <div
                              className={`flex items-center gap-3 rounded-lg pl-8 text-sm text-muted-foreground transition-all hover:text-primary ${
                                pathname === "/manage-lineups"
                                  ? "text-primary"
                                  : ""
                              }`}
                            >
                              <Minus size={10} />
                              Manage Lineups
                            </div>
                          </Link>
                        </SheetTrigger>
                      )}
                      <SheetTrigger asChild>
                        <Link href="/standings">
                          <div
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/standings" ? "text-primary" : ""
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            Standings
                          </div>
                        </Link>
                      </SheetTrigger>
                      <SheetTrigger asChild>
                        <Link href="/new-features">
                          <div
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/new-features" ? "text-primary" : ""
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            More Coming Soon
                          </div>
                        </Link>
                      </SheetTrigger>
                      <Separator />
                      <SheetTrigger asChild>
                        <Link href="/account">
                          <div
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname === "/account" ? "text-primary" : ""
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            Account
                          </div>
                        </Link>
                      </SheetTrigger>
                      {isLoggedIn && (
                        <SheetTrigger asChild>
                          <Link href="/manage-teams">
                            <div
                              className={`flex items-center gap-3 rounded-lg pl-8 text-sm text-muted-foreground transition-all hover:text-primary ${
                                pathname === "/manage-teams"
                                  ? "text-primary"
                                  : ""
                              }`}
                            >
                              <Minus size={10} />
                              Manage Teams
                            </div>
                          </Link>
                        </SheetTrigger>
                      )}
                    </>
                  )}
                </nav>
                <div className="mt-auto flex">
                  <ModeToggle />
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex w-full items-center">
              <div
                className={`text-4xl ml-[-2%] mt-[2%] md:text-5xl lg:text-6xl lg:ml-[7%] w-full text-center font-bold pb-3 ${font.className}`}
              >
                <Title />
                {isInMaintenance && (
                  <span className="text-sm font-normal text-amber-500 ml-2">
                    (Maintenance Mode)
                  </span>
                )}
              </div>
              <div className="px-2 flex-col gap-1 hidden md:flex">
                <div className="flex gap-1 justify-center">
                  {!isInMaintenance && (
                    <Link href="/account">
                      <div className="hover:border-primary">
                        <Button variant="outline" size="icon">
                          <User className="h-5 w-5" />
                        </Button>
                      </div>
                    </Link>
                  )}
                  <ModeToggle />
                </div>
                <Separator />
                {!isLoggedIn && !isInMaintenance && (
                  <Link href="/account">
                    <div className="hover:border-primary">
                      <Button variant="outline">Sign In</Button>
                    </div>
                  </Link>
                )}
                {isLoggedIn && !isInMaintenance && <TeamDropdown />}
              </div>
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            {loading && !isInMaintenance && <SkeletonCard />}
            {!loading && children}
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;

const Title = () => {
  return <>Court Vision</>;
};
