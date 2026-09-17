import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AngularPanel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes("nexus-panel", className)} {...props}>{children}</div>;
}

export function SectionEyebrow({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={classes("nexus-eyebrow", className)} {...props}><span aria-hidden="true" />{children}</p>;
}

type ActionButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
} & (
  | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">)
  | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">)
);

export function ActionButton({ children, className, variant = "primary", ...props }: ActionButtonProps) {
  const actionClass = classes("nexus-action", `nexus-action-${variant}`, className);
  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props;
    return <Link href={href} className={actionClass} {...anchorProps}>{children}</Link>;
  }
  return <button className={actionClass} {...props as ButtonHTMLAttributes<HTMLButtonElement>}>{children}</button>;
}

type CoverFrameProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  ratio?: "portrait" | "square";
};

export function CoverFrame({ children, className, ratio = "portrait", ...props }: CoverFrameProps) {
  return <div className={classes("nexus-cover-frame", `nexus-cover-${ratio}`, className)} {...props}>{children}</div>;
}

type PageHeroProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function PageHero({ children, className, eyebrow, title, ...props }: PageHeroProps) {
  return (
    <section className={classes("nexus-page-hero", className)} {...props}>
      <StarfieldMotif />
      <div aria-hidden="true" className="nexus-page-hero-visual"><span /></div>
      <svg aria-hidden="true" className="nexus-page-hero-frame" viewBox="0 0 1000 240" preserveAspectRatio="none">
        <path className="nexus-page-hero-frame-primary" d="M18 2 H615 M660 2 H970 L998 30 V72 M998 168 V210 L980 238 H610 M565 238 H36 L2 204 V154 M2 92 V34 L34 2" />
        <path className="nexus-page-hero-frame-secondary" d="M2 54 L34 18 H125 M875 18 H962 L982 38 M18 190 V215 L42 232 H82 M918 232 H974" />
      </svg>
      <div className="nexus-page-hero-content">
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        <h1 className="nexus-page-hero-title">{title}</h1>
        <div className="nexus-page-hero-body">{children}</div>
      </div>
    </section>
  );
}

/** Ambient decoration only; never contributes to reading or pointer order. */
export function StarfieldMotif({ className }: { className?: string }) {
  return <div aria-hidden="true" className={classes("nexus-starfield", className)} />;
}
