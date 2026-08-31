import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import { getProfile } from "@/profile/profile";
import { TabRow, tabClassName } from "@/app/tab-row";
import { ProfileForm } from "./profile-form";
import { listOwnedMaterials } from "@/materials/materials";
import { MaterialsOwned } from "./materials-owned";
import { removeMaterialAction } from "./material-actions";

const profileTabs = ["details", "materials"] as const;
type ProfileTab = (typeof profileTabs)[number];

function selectedProfileTab(value: string | string[] | undefined): ProfileTab {
  const requested = Array.isArray(value) ? value[0] : value;
  return profileTabs.includes(requested as ProfileTab) ? requested as ProfileTab : "details";
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fprofile");
  const tab = selectedProfileTab((await searchParams).tab);
  const profile = await getProfile(actor);
  if (!profile) redirect("/sign-in");
  const materials = tab === "materials" ? await listOwnedMaterials(actor) : null;
  return <main className="page-shell mx-auto min-h-screen max-w-3xl"><section className="card-standard responsive-card sm:rounded-3xl sm:p-10">
    <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase sm:text-sm sm:tracking-[0.2em]">Your account</p>
    <h1 className="responsive-title mt-2 font-semibold sm:mt-3">Personal profile</h1>
    <p className="mt-3 break-words text-text-muted">Signed in as {profile.email}. Add only the details you want to share in relevant play areas.</p>
    <nav aria-label="Profile sections"><TabRow className="-mx-1 mt-5 px-1 sm:-mx-2 sm:mt-8 sm:px-2">{profileTabs.map((item) => <Link key={item} href={item === "details" ? "/profile" : `/profile?tab=${item}`} aria-current={tab === item ? "page" : undefined} className={tabClassName(tab === item, "capitalize")}>{item}</Link>)}</TabRow></nav>
    {tab === "details" ? <section className="mt-8"><h2 className="text-2xl font-semibold">Personal details</h2><p className="mt-1 text-sm text-text-muted">Manage the information used for organized play and session coordination.</p><div className="mt-6"><ProfileForm profile={profile} /></div></section> : null}
    {tab === "materials" && materials ? <div className="mt-8"><MaterialsOwned materials={materials} removeAction={removeMaterialAction} /></div> : null}
  </section></main>;
}
