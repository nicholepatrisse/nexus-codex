import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicleSheetAttachments, chronicles, communities, contentItems, people, sessionGmCredits, sessionSignups, sessions } from "@/db/schema";
import { CancelSessionButton } from "./cancel-session-button";
import { PublishSessionButton } from "./publish-session-button";
import { OwnSessionSignup, type OwnSessionSignupDetails } from "./own-session-signup";
import { canViewPrivateRosterDetails, SessionRoster, type SessionRosterEntry } from "./session-roster";
import { SessionSignupControl } from "../../session-signup-control";
import type { Metadata } from "next";
import { defaultSocialMetadata, socialMetadata } from "@/app/social-metadata";
import { getCharacterProgressions, listCharacters } from "@/character/characters";
import { getOwnGmCredit } from "@/session/gm-credit";
import { GmCreditForm } from "./gm-credit-form";
import { CompleteSessionForm, type CompletionCharacter } from "./complete-session-form";
import { PlayerCharacterAssignments, type UnassignedParticipant } from "./player-character-assignment";
import { PaizoReportingReminder } from "./paizo-reporting-reminder";
import { SessionStatusPill } from "@/app/session-status-pill";
import { DescriptionItem, DescriptionList } from "@/app/description-list";
import { defaultPregenLevel } from "@/character/sfs2-pregens";
import { getCharacterValidationReview } from "@/character/character-validation-review";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; sessionId: string }> }): Promise<Metadata> {
  const { slug, sessionId } = await params;
  const access = await resolveCommunityAccessBySlug(slug, null).catch(() => ({ status: "unavailable" as const }));
  if (access.status !== "available" || access.community.scheduleVisibility !== "public") return defaultSocialMetadata;
  const [session] = await getDb()
    .select({ code: contentItems.code, title: contentItems.title, startsAt: sessions.startsAt })
    .from(sessions)
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id), inArray(sessions.status, ["published", "completed", "cancelled"])))
    .limit(1)
    .catch(() => []);
  if (!session) return defaultSocialMetadata;
  const sessionName = `${session.code} — ${session.title}`;
  const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(session.startsAt);
  return socialMetadata({
    title: `${sessionName} | Nexus Codex`,
    description: `${access.community.name} · ${date}`,
    pathname: `/communities/${encodeURIComponent(access.community.slug)}/sessions/${encodeURIComponent(sessionId)}`,
  });
}

function formatInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
}

function SessionDetails({ session, browserZone }: { session: { gmName: string; playerCapacity: number; startsAt: Date; endsAt: Date; locationType: string }; browserZone: string }) {
  return <DescriptionList columns={2} className="mt-8">
    <DescriptionItem label="Game Master">{session.gmName}</DescriptionItem>
    <DescriptionItem label="Player capacity">{session.playerCapacity}</DescriptionItem>
    <DescriptionItem label="Your local time">{formatInstant(session.startsAt, browserZone)} – {formatInstant(session.endsAt, browserZone)}</DescriptionItem>
    <DescriptionItem label="Location" valueClassName="capitalize">{session.locationType}</DescriptionItem>
  </DescriptionList>;
}

export default async function SessionPage({ params, searchParams }: { params: Promise<{ slug: string; sessionId: string }>; searchParams?: Promise<{ completed?: string }> }) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  const access = await resolveCommunityAccessBySlug(slug, actor?.personId ?? null);
  if (access.status !== "available") notFound();
  const [session] = await getDb().select({ id: sessions.id, status: sessions.status, gameSystemId: sessions.gameSystemId, gmPersonId: sessions.gmPersonId, gmName: people.displayName, gmDiscordHandle: people.discordHandle, gmOrganizedPlayNumber: people.societyPlayNumber, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, scenarioMinimumLevel: contentItems.minimumLevel, scenarioMaximumLevel: contentItems.maximumLevel, startsAt: sessions.startsAt, endsAt: sessions.endsAt, displayTimeZone: sessions.displayTimeZone, playerCapacity: sessions.playerCapacity, notes: sessions.notes, locationType: sessions.locationType, communityEventName: communities.eventName, communityEventCode: communities.eventCode, paizoReportedAt: sessions.paizoReportedAt }).from(sessions).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!session) notFound();
  const scenarioPregenLevel = defaultPregenLevel(session.scenarioMinimumLevel, session.scenarioMaximumLevel);
  const isOwner = access.roles.includes("owner");
  const isAssignedGm = Boolean(actor) && session.gmPersonId === actor!.personId;
  const isManager = isOwner || isAssignedGm;
  const role: CommunityRole = isOwner ? "owner" : access.roles.includes("gm") ? "gm" : access.isActiveMember ? "member" : "visitor";
  const canViewSchedule = canPerformCommunityOperation(role, "schedule.view", { visibility: access.community.visibility === "public" ? "public" : "private", scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members" });
  if (session.status === "draft" ? !isManager : !canViewSchedule) notFound();

  let confirmedCount = 0;
  let waitlistedCount = 0;
  let roster: SessionRosterEntry[] | undefined;
  let ownSignup: OwnSessionSignupDetails | undefined;
  let eligibleCharacters: { id: string; name: string; societyNumber: string; currentLevel: number }[] = [];
  let completionCharacters: CompletionCharacter[] = [];
  let participantsWithoutCharacters: string[] = [];
  let unassignedParticipants: UnassignedParticipant[] = [];
  if (session.status !== "draft") {
    const rows = await getDb().select({ id: sessionSignups.id, personId: sessionSignups.personId, status: sessionSignups.status, waitlistPosition: sessionSignups.waitlistPosition, personName: people.displayName, discordHandle: people.discordHandle, characterId: characters.id, characterName: characters.name, characterSocietyNumber: characters.societyNumber, characterStartingLevel: characters.startingLevel, characterClassName: characters.className, characterAncestry: characters.ancestry, characterBackground: characters.background, gameSystemId: characters.gameSystemId, pregenName: sessionSignups.pregenName, pregenLevel: sessionSignups.pregenLevel, creditRecipientCharacterId: sessionSignups.creditRecipientCharacterId }).from(sessionSignups).innerJoin(people, eq(people.id, sessionSignups.personId)).leftJoin(characters, eq(characters.id, sessionSignups.characterId)).where(and(eq(sessionSignups.sessionId, session.id), inArray(sessionSignups.status, ["confirmed", "waitlisted"]))).orderBy(asc(sessionSignups.waitlistPosition), asc(sessionSignups.createdAt));
    const creditRecipientIds = rows.flatMap((row) => row.creditRecipientCharacterId ? [row.creditRecipientCharacterId] : []);
    const creditRecipients = creditRecipientIds.length ? await getDb().select().from(characters).where(inArray(characters.id, creditRecipientIds)) : [];
    const creditRecipientById = new Map(creditRecipients.map((character) => [character.id, character]));
    const rosterCharacters = rows.flatMap((row) => { const recipient = row.creditRecipientCharacterId ? creditRecipientById.get(row.creditRecipientCharacterId) : undefined; return row.characterId && row.characterStartingLevel ? [{ id: row.characterId, startingLevel: row.characterStartingLevel }] : recipient ? [{ id: recipient.id, startingLevel: recipient.startingLevel }] : []; });
    const progressionByCharacter = await getCharacterProgressions(rosterCharacters);
    confirmedCount = rows.filter(({ status }) => status === "confirmed").length;
    waitlistedCount = rows.filter(({ status }) => status === "waitlisted").length;
    const persistedOwnSignup = actor ? rows.find(({ personId }) => personId === actor.personId) : undefined;
    const ownRecipient = persistedOwnSignup?.creditRecipientCharacterId ? creditRecipientById.get(persistedOwnSignup.creditRecipientCharacterId) : undefined;
    if (persistedOwnSignup && ((persistedOwnSignup.characterName && persistedOwnSignup.characterId) || (persistedOwnSignup.pregenName && ownRecipient))) {
      ownSignup = {
        status: persistedOwnSignup.status === "confirmed" ? "confirmed" : "waitlisted",
        characterName: persistedOwnSignup.pregenName ?? persistedOwnSignup.characterName!,
        characterSocietyNumber: persistedOwnSignup.characterSocietyNumber,
        characterLevel: persistedOwnSignup.pregenLevel ?? (persistedOwnSignup.characterId ? progressionByCharacter.get(persistedOwnSignup.characterId)?.currentLevel : null),
        waitlistPosition: persistedOwnSignup.waitlistPosition,
        characterId: persistedOwnSignup.characterId ?? undefined,
        pregenName: persistedOwnSignup.pregenName ?? undefined,
        pregenLevel: persistedOwnSignup.pregenLevel ?? undefined,
        creditRecipientCharacterId: ownRecipient?.id,
        creditRecipientCharacterName: ownRecipient?.name,
        scenarioPregenLevel,
        slug,
        sessionId: session.id,
        canManage: session.status === "published" && session.startsAt > new Date(),
      };
      eligibleCharacters = (await listCharacters(actor!)).filter(({ gameSystemId }) => gameSystemId === session.gameSystemId).map(({ id, name, societyNumber, currentLevel }) => ({ id, name, societyNumber, currentLevel }));
      ownSignup.characters = eligibleCharacters;
    }
    const showPrivateRosterDetails = canViewPrivateRosterDetails(isManager);
    const validationByCharacter = new Map<string, NonNullable<Awaited<ReturnType<typeof getCharacterValidationReview>>>["summary"]>();
    if (isManager && actor) {
      const reviews = await Promise.all(rows.flatMap((row) => row.characterId && !row.pregenName ? [{ characterId: row.characterId, review: getCharacterValidationReview(actor, row.characterId) }] : []).map(async ({ characterId, review }) => ({ characterId, review: await review })));
      for (const { characterId, review } of reviews) if (review) validationByCharacter.set(characterId, review.summary);
    }
    roster = rows.map((row) => ({ id: row.id, personName: row.personName, characterId: row.characterId, discordHandle: showPrivateRosterDetails ? row.discordHandle : null, characterName: row.pregenName ?? row.characterName, characterSocietyNumber: showPrivateRosterDetails ? row.characterSocietyNumber : null, characterLevel: row.pregenLevel ?? (row.characterId ? progressionByCharacter.get(row.characterId)?.currentLevel : null), characterClassName: row.characterClassName, characterAncestry: row.characterAncestry, characterBackground: row.characterBackground, validationSummary: row.characterId ? validationByCharacter.get(row.characterId) : null, pregen: Boolean(row.pregenName), creditRecipientName: showPrivateRosterDetails && row.creditRecipientCharacterId ? creditRecipientById.get(row.creditRecipientCharacterId)?.name : null, status: row.status === "confirmed" ? "confirmed" : "waitlisted", ...(row.waitlistPosition ? { waitlistPosition: row.waitlistPosition } : {}) }));
    if (isManager) completionCharacters = rows.flatMap((row) => { const recipient = row.creditRecipientCharacterId ? creditRecipientById.get(row.creditRecipientCharacterId) : undefined; const characterId = recipient?.id ?? row.characterId; const characterName = recipient?.name ?? row.characterName; const level = characterId ? progressionByCharacter.get(characterId)?.currentLevel : undefined; return row.status === "confirmed" && characterId && characterName ? [{ characterId, characterName, playerName: row.personName, societyNumber: recipient?.societyNumber ?? row.characterSocietyNumber, level, className: recipient?.className ?? row.characterClassName, relationship: row.pregenName ? "Pregen Credit" as const : "Player" as const, playedAs: row.pregenName ? `${row.pregenName} (level ${row.pregenLevel})` : undefined, gmNotes: "", advancementSpeed: "standard" as const, xp: 4, baseCreditsMinor: ({1:140,2:220,3:380,4:640,5:1000,6:1500,7:2200,8:3000,9:4400,10:6000} as Record<number,number>)[level ?? 1] ?? 0, downtimeDisposition: "declined" as const, downtimeCheckTotal: null, downtimeProficiency: null, downtimeOverrideCreditsMinor: null, downtimeCorrectionNote: "", downtimeActivity: "", chronicleNumber: "", partnerCode: "", eventName: session.communityEventName ?? access.community.name, eventCode: session.communityEventCode ?? "", gmOrganizedPlayId: session.gmOrganizedPlayNumber ?? "" }] : []; });
    if (isManager) participantsWithoutCharacters = rows.filter((row) => row.status === "confirmed" && !row.characterId && !row.creditRecipientCharacterId).map(({ personName }) => personName);
    if (isManager && participantsWithoutCharacters.length) {
      const missing = rows.filter((row) => row.status === "confirmed" && !row.characterId);
      const options = await getDb().select({ id: characters.id, personId: characters.personId, name: characters.name, societyNumber: characters.societyNumber, startingLevel: characters.startingLevel, className: characters.className }).from(characters).where(and(inArray(characters.personId, missing.map(({ personId }) => personId)), eq(characters.gameSystemId, session.gameSystemId)));
      const optionProgressions = await getCharacterProgressions(options.map(({ id, startingLevel }) => ({ id, startingLevel })));
      unassignedParticipants = missing.map((participant) => ({ signupId: participant.id, personName: participant.personName, characters: options.filter(({ personId }) => personId === participant.personId).map((character) => ({ id: character.id, name: character.name, societyNumber: character.societyNumber, currentLevel: optionProgressions.get(character.id)?.currentLevel ?? character.startingLevel, className: character.className })) }));
    }
  }
  const cancelled = session.status === "cancelled";
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (actor && session.status === "published" && session.gmPersonId !== actor.personId && !ownSignup) {
    const sessionCharacters = await listCharacters(actor);
    const [sessionSystem] = await getDb().select({ gameSystemId: sessions.gameSystemId }).from(sessions).where(eq(sessions.id, session.id)).limit(1);
    eligibleCharacters = sessionCharacters.filter(({ gameSystemId }) => gameSystemId === sessionSystem?.gameSystemId).map(({ id, name, societyNumber, currentLevel }) => ({ id, name, societyNumber, currentLevel }));
    return <main className="page-shell mx-auto min-h-screen max-w-3xl">
      <Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-brand hover:underline">← {access.community.name}</Link>
      <section className="responsive-card mt-6 rounded-3xl border border-border bg-surface sm:mt-8 sm:p-10">
        <div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Session</p><h1 className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{session.scenarioCode} — {session.scenarioTitle}</h1></div>
        <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:mt-8 sm:p-5" aria-labelledby="signup-heading"><h2 id="signup-heading" className="text-lg font-semibold">Sign up for this game</h2><SessionSignupControl slug={slug} sessionId={session.id} scenarioPregenLevel={scenarioPregenLevel} characters={eligibleCharacters} /></section>
        <SessionDetails session={session} browserZone={browserZone} />
        {session.notes ? <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-text-muted">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}
        <SessionRoster capacity={session.playerCapacity} confirmedCount={confirmedCount} waitlistedCount={waitlistedCount} />
      </section>
    </main>;
  }
  const gmCreditCharacters = isAssignedGm && actor ? (await listCharacters(actor)).filter(({ gameSystemId }) => gameSystemId === session.gameSystemId).map(({ id, name, societyNumber, currentLevel, className }) => ({ id, name, societyNumber, currentLevel, className })) : [];
  const ownGmCredit = isAssignedGm && actor ? await getOwnGmCredit(actor, session.id) : null;
  if (isManager) {
    const gmCredits = await getDb().select({ characterId: characters.id, characterName: characters.name, societyNumber: characters.societyNumber, startingLevel: characters.startingLevel, className: characters.className, playerName: people.displayName }).from(sessionGmCredits).innerJoin(characters, eq(characters.id, sessionGmCredits.characterId)).innerJoin(people, eq(people.id, sessionGmCredits.gmPersonId)).where(eq(sessionGmCredits.sessionId, session.id));
    const creditProgressions = await getCharacterProgressions(gmCredits.map(({ characterId, startingLevel }) => ({ id: characterId, startingLevel })));
    completionCharacters.push(...gmCredits.map((row) => ({ characterId: row.characterId, characterName: row.characterName, playerName: row.playerName, societyNumber: row.societyNumber, level: creditProgressions.get(row.characterId)?.currentLevel, className: row.className, relationship: "GM Credit" as const, gmNotes: "", advancementSpeed: "standard" as const, xp: 4, baseCreditsMinor: ({1:140,2:220,3:380,4:640,5:1000,6:1500,7:2200,8:3000,9:4400,10:6000} as Record<number,number>)[creditProgressions.get(row.characterId)?.currentLevel ?? 1] ?? 0, downtimeDisposition: "declined" as const, downtimeCheckTotal: null, downtimeProficiency: null, downtimeOverrideCreditsMinor: null, downtimeCorrectionNote: "", downtimeActivity: "", chronicleNumber: "", partnerCode: "", eventName: session.communityEventName ?? access.community.name, eventCode: session.communityEventCode ?? "", gmOrganizedPlayId: session.gmOrganizedPlayNumber ?? "" })));
    const existing = completionCharacters.length ? await getDb().select().from(chronicles).where(and(eq(chronicles.sessionId, session.id), inArray(chronicles.characterId, completionCharacters.map(({ characterId }) => characterId)))) : [];
    const sheets = existing.length ? await getDb().select({ chronicleId: chronicleSheetAttachments.chronicleId, filename: chronicleSheetAttachments.originalFilename }).from(chronicleSheetAttachments).where(and(inArray(chronicleSheetAttachments.chronicleId, existing.map(({ id }) => id)), eq(chronicleSheetAttachments.isCurrent, true))) : [];
    const byCharacter = new Map(existing.map((chronicle) => [chronicle.characterId, chronicle]));
    const sheetByChronicle = new Map(sheets.map((sheet) => [sheet.chronicleId, sheet.filename]));
    completionCharacters = completionCharacters.map((character) => { const chronicle = byCharacter.get(character.characterId); return chronicle ? { ...character, chronicleId: chronicle.id, sheetFilename: sheetByChronicle.get(chronicle.id) ?? null, level: chronicle.characterLevel, advancementSpeed: chronicle.advancementSpeed === "slow" ? "slow" : "standard", xp: chronicle.xp, baseCreditsMinor: chronicle.baseCreditsMinor, downtimeDisposition: chronicle.downtimeDisposition as "earn_income" | "other" | "declined", downtimeCheckTotal: chronicle.downtimeCheckTotal, downtimeProficiency: chronicle.downtimeProficiency as "trained" | "expert" | "master" | null, downtimeOverrideCreditsMinor: chronicle.downtimeOverrideCreditsMinor, downtimeCorrectionNote: chronicle.downtimeCorrectionNote ?? "", downtimeActivity: chronicle.downtimeActivity ?? "", chronicleNumber: chronicle.chronicleNumber ?? "", partnerCode: chronicle.partnerCode ?? "", eventName: chronicle.eventName ?? "", eventCode: chronicle.eventCode ?? "", gmOrganizedPlayId: chronicle.gmOrganizedPlayId ?? "", gmNotes: chronicle.gmNotes ?? "" } : character; });
  }
  if (isManager && completionCharacters.length) {
    const progressionCharacters = await getDb().select({ id: characters.id, startingLevel: characters.startingLevel }).from(characters).where(inArray(characters.id, completionCharacters.map(({ characterId }) => characterId)));
    const progression = await getCharacterProgressions(progressionCharacters);
    const ledger = await getDb().select({ characterId: characterCreditLedgerEntries.characterId, amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(inArray(characterCreditLedgerEntries.characterId, completionCharacters.map(({ characterId }) => characterId)));
    const creditsByCharacter = new Map<string, number>();
    for (const entry of ledger) creditsByCharacter.set(entry.characterId, (creditsByCharacter.get(entry.characterId) ?? 0) + entry.amountMinor);
    completionCharacters = completionCharacters.map((character) => ({ ...character, startingXp: progression.get(character.characterId)?.totalXp ?? 0, startingCredits: creditsByCharacter.get(character.characterId) ?? 0 }));
  }
  completionCharacters = completionCharacters.map((character) => ({ ...character, scenario: `${session.scenarioCode} — ${session.scenarioTitle}`, playedOn: session.startsAt.toISOString().slice(0, 10) }));
  const completed = session.status === "completed";
  const justCompleted = (await searchParams)?.completed === "1";
  return <main className="page-shell mx-auto min-h-screen max-w-3xl">
    <Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-brand hover:underline">← {access.community.name}</Link>
    <section className="responsive-card mt-6 rounded-3xl border border-border bg-surface sm:mt-8 sm:p-10">
      {cancelled ? <p role="status" className="mb-6 rounded-xl bg-danger/10 p-4 font-semibold text-danger">This session has been cancelled.</p> : null}
      {completed ? <p role="status" className="mb-6 rounded-xl bg-success/10 p-4 font-semibold text-success">{justCompleted ? "Session completed. Chronicle records are ready for player review." : "Completed"}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{session.status === "draft" ? "Session draft" : "Session"}</p><SessionStatusPill status={session.status === "draft" ? "draft" : session.status === "completed" ? "completed" : session.status === "cancelled" ? "cancelled" : "published"} startsAt={session.startsAt} paizoReportedAt={session.paizoReportedAt} /></div><h1 className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{session.scenarioCode} — {session.scenarioTitle}</h1></div>
        {isManager ? <div className="flex flex-wrap gap-3">{session.status === "published" ? <CompleteSessionForm slug={slug} sessionId={session.id} characters={completionCharacters} participantsWithoutCharacters={participantsWithoutCharacters} completed={false} future={session.startsAt > new Date()} /> : null}{!cancelled && !completed ? <Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}/edit`} className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold">Edit {session.status === "draft" ? "draft" : "session"}</Link> : null}{session.status === "draft" ? <PublishSessionButton slug={slug} sessionId={session.id} /> : session.status === "published" ? <CancelSessionButton slug={slug} sessionId={session.id} /> : null}</div> : null}
      </div>
      {ownSignup ? <OwnSessionSignup signup={ownSignup} /> : null}
      {isAssignedGm && session.status !== "draft" && !completed ? <GmCreditForm slug={slug} sessionId={session.id} characters={gmCreditCharacters} current={ownGmCredit} /> : null}
      {isManager && session.status === "published" ? <PlayerCharacterAssignments slug={slug} sessionId={session.id} participants={unassignedParticipants} /> : null}
      {isManager && completed ? <CompleteSessionForm slug={slug} sessionId={session.id} characters={completionCharacters} participantsWithoutCharacters={participantsWithoutCharacters} completed future={false} /> : null}
      {isManager && completed ? <PaizoReportingReminder slug={slug} sessionId={session.id} reportedAt={session.paizoReportedAt} justCompleted={justCompleted} /> : null}
      <SessionDetails session={session} browserZone={browserZone} />
      {session.notes ? <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-text-muted">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}
      {session.status === "draft" ? <p className="mt-8 rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-muted">This draft is private and is not part of the public schedule.</p> : <><SessionRoster capacity={session.playerCapacity} confirmedCount={confirmedCount} waitlistedCount={waitlistedCount} entries={roster} expandable={isManager} /><p className="mt-8 text-sm text-text-muted">Share this page’s URL. It remains the session’s permanent address, including after cancellation.</p></>}
    </section>
  </main>;
}
