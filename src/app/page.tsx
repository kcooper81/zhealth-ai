import { redirect } from "next/navigation";

/**
 * The portal is the team's main destination. Visiting / sends users
 * straight to /portal.
 */
export default function Home() {
  redirect("/portal");
}
