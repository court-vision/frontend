"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Context to manage site maintenance status
const MaintenanceContext = createContext({
  isInMaintenance: false,
  maintenanceMessage:
    "Court Vision is currently offline for the off-season. I'll be back with more features for the next fantasy basketball season!",
});

export const MaintenanceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isInMaintenance] = useState(false);
  const [maintenanceMessage] = useState(
    "Court Vision is currently offline for the off-season. I'll be back with more features for the next fantasy basketball season!"
  );
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to home page if not already there and site is in maintenance
  useEffect(() => {
    if (isInMaintenance && pathname !== "/") {
      router.push("/");
    }
  }, [isInMaintenance, pathname, router]);

  return (
    <MaintenanceContext.Provider
      value={{ isInMaintenance, maintenanceMessage }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => useContext(MaintenanceContext);
