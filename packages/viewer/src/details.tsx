import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { DiagramNode, DiagramSpec } from "@arch4/core";
import { titleForType } from "./icons.js";
import {
  relationshipViewLabel,
  resolveIndexedRelationshipsOutsideCurrentView,
  relatedTargetLabel,
  resolveCurrentViewRelationships,
} from "./navigation.js";
import type {
  Arch4ElementInfo,
  Arch4RelatedNavigationTarget,
} from "./types.js";

export function ElementInfoPanel(props: {
  activeDiagram: DiagramSpec;
  diagrams: DiagramSpec[];
  extension?: ReactNode;
  info: Arch4ElementInfo;
  node: DiagramNode;
  relatedTargets: Arch4RelatedNavigationTarget[];
  onClose: () => void;
  onNavigate: (target: Arch4RelatedNavigationTarget) => void;
}) {
  const currentRelationships = resolveCurrentViewRelationships(
    props.activeDiagram,
    props.node,
  );
  const indexedRelationships = resolveIndexedRelationshipsOutsideCurrentView(
    props.activeDiagram,
    props.info.relationships,
  );
  return (
    <aside className="arch4-details" aria-labelledby="arch4-info-title">
      <div className="arch4-details-header">
        <span className="arch4-eyebrow">Element Info</span>
        <h2 id="arch4-info-title">{props.info.name}</h2>
        <button
          aria-label="Close details"
          className="arch4-close"
          type="button"
          onClick={props.onClose}
        >
          <X size={16} />
        </button>
      </div>
      {props.info.description && <p>{props.info.description}</p>}
      {props.extension}
      <dl>
        <Detail label="Entity" value={props.info.entityId} />
        <Detail label="Type" value={props.info.type} />
        <Detail label="Technology" value={props.info.technology} />
        <Detail label="Parent" value={props.info.parent} />
        <Detail label="Paths" value={props.info.paths.join(", ")} />
        <Detail label="Owners" value={props.info.owners.join(", ")} />
        <Detail label="Confidence" value={props.info.confidence} />
        <Detail label="Tags" value={props.info.tags.join(", ")} />
        <Detail label="Context" value={props.info.contextPath} />
      </dl>
      <InfoSection title="Related Views" empty="No related views.">
        {props.relatedTargets.map((target) => (
          <li
            className="arch4-related-view-item"
            key={`${target.kind}:${target.diagram.id}:${target.entityId}`}
          >
            <button
              className="arch4-related-view-button"
              type="button"
              onClick={() => props.onNavigate(target)}
            >
              <strong>{relatedTargetLabel(target)}</strong>
              <span>
                {target.diagram.name} · {titleForType(target.diagram.type)}
              </span>
            </button>
          </li>
        ))}
      </InfoSection>
      <RelationshipsSection
        relationships={currentRelationships}
        title="Relationships In This View"
        empty="No relationships in this view."
        layout="horizontal"
      />
      <RelationshipsSection
        relationships={indexedRelationships}
        title="Relationships Across Indexed Views"
        empty="No indexed relationships."
        renderMeta={(relationship) =>
          relationship.views.length > 0 ? (
            <span>
              Views:{" "}
              {relationship.views
                .map((viewId) =>
                  relationshipViewLabel(viewId, props.info, props.diagrams),
                )
                .join(", ")}
            </span>
          ) : null
        }
      />
      <InfoSection title="Open Questions" empty="No open questions.">
        {props.info.openQuestions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </InfoSection>
      <section>
        <h3>Notes</h3>
        {props.info.notes && Object.keys(props.info.notes).length > 0 ? (
          <pre>{JSON.stringify(props.info.notes, null, 2)}</pre>
        ) : (
          <p className="arch4-muted">No notes.</p>
        )}
      </section>
      <InfoSection title="Contributors" empty="No contributor data.">
        {props.info.contributors.map((contributor) => (
          <li key={contributor.email ?? contributor.name}>
            <strong>{contributor.name}</strong>{" "}
            <span>{contributor.commits} commits</span>
          </li>
        ))}
      </InfoSection>
      <InfoSection title="Recent Changes" empty="No recent changes.">
        {props.info.recentCommits.slice(0, 8).map((commit) => (
          <li key={commit.hash}>
            <strong>{commit.hash.slice(0, 8)}</strong>{" "}
            <span>
              {commit.date} · {commit.subject}
            </span>
          </li>
        ))}
      </InfoSection>
    </aside>
  );
}

function InfoSection(props: {
  children: ReactNode;
  empty: string;
  title: string;
}) {
  const items = Array.isArray(props.children)
    ? props.children.filter(Boolean)
    : props.children
      ? [props.children]
      : [];
  return (
    <section>
      <h3>{props.title}</h3>
      {items.length ? (
        <ul>{props.children}</ul>
      ) : (
        <p className="arch4-muted">{props.empty}</p>
      )}
    </section>
  );
}

type RelationshipDisplay = {
  direction: "inbound" | "outbound";
  id: string;
  label?: string;
  sourceName: string;
  targetName: string;
  technology?: string;
};

function RelationshipsSection<T extends RelationshipDisplay>(props: {
  empty: string;
  layout?: "horizontal" | "stacked";
  relationships: T[];
  renderMeta?: (relationship: T) => ReactNode;
  title: string;
}) {
  const incoming = props.relationships.filter(
    (relationship) => relationship.direction === "inbound",
  );
  const outgoing = props.relationships.filter(
    (relationship) => relationship.direction === "outbound",
  );
  if (props.relationships.length === 0) {
    return (
      <section>
        <h3>{props.title}</h3>
        <p className="arch4-muted">{props.empty}</p>
      </section>
    );
  }

  return (
    <section className="arch4-relationships">
      <h3>{props.title}</h3>
      <RelationshipSubsection
        relationships={incoming}
        title="INCOMING"
        empty="No incoming relationships."
        layout={props.layout}
        renderMeta={props.renderMeta}
      />
      <RelationshipSubsection
        relationships={outgoing}
        title="OUTGOING"
        empty="No outgoing relationships."
        layout={props.layout}
        renderMeta={props.renderMeta}
      />
    </section>
  );
}

function RelationshipSubsection<T extends RelationshipDisplay>(props: {
  empty: string;
  layout?: "horizontal" | "stacked";
  relationships: T[];
  renderMeta?: (relationship: T) => ReactNode;
  title: string;
}) {
  return (
    <div className="arch4-relationship-group">
      <h4>{props.title}</h4>
      {props.relationships.length > 0 ? (
        <ul className="arch4-relationship-list">
          {props.relationships.map((relationship) => (
            <RelationshipItem
              key={`${relationship.direction}:${relationship.id}`}
              relationship={relationship}
              layout={props.layout}
              renderMeta={props.renderMeta}
            />
          ))}
        </ul>
      ) : (
        <p className="arch4-muted arch4-relationship-empty">{props.empty}</p>
      )}
    </div>
  );
}

function RelationshipItem<T extends RelationshipDisplay>(props: {
  layout?: "horizontal" | "stacked";
  relationship: T;
  renderMeta?: (relationship: T) => ReactNode;
}) {
  return (
    <li
      className={`arch4-relationship-item ${props.layout === "horizontal" ? "horizontal" : ""}`}
    >
      <span className="arch4-relationship-entity">
        {props.relationship.sourceName}
      </span>
      <span className="arch4-relationship-description">
        <strong>{props.relationship.label || props.relationship.id}</strong>
        {props.relationship.technology && (
          <span>{props.relationship.technology}</span>
        )}
        {props.renderMeta?.(props.relationship)}
      </span>
      <span className="arch4-relationship-entity">
        {props.relationship.targetName}
      </span>
    </li>
  );
}

function Detail(props: { label: string; value?: string | null }) {
  if (!props.value) return null;
  return (
    <>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </>
  );
}
