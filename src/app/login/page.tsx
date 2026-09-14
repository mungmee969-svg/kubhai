import { redirect } from "next/navigation";

/** Legacy path — Store Admin login lives at /store/login */
export default function LoginRedirectPage() {
  redirect("/store/login");
}
