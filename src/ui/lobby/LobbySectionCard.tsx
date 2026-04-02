import type { ReactNode } from 'react';

type LobbySectionCardProps = {
    title: string;
    children: ReactNode;
    className?: string;
    showTitle?: boolean;
};

export function LobbySectionCard(props: LobbySectionCardProps) {
    return (
        <section className={`rounded-2xl border border-[#8f6a38]/30 bg-black/28 px-4 py-4 backdrop-blur-sm ${props.className ?? ''}`}>
            {props.showTitle !== false ? (
                <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.title}</div>
            ) : null}
            <div className={props.showTitle !== false ? 'mt-3' : undefined}>{props.children}</div>
        </section>
    );
}
