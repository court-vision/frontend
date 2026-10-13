import { Landing } from "@/components/landing/Landing";

/**
 * The front door: the landing page signed out. It prerenders; a signed-in
 * visitor never reaches it, since the proxy sends them to their Week desk.
 */
export default function Home() {
  return <Landing />;
}
