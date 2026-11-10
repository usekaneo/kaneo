import { Icon } from "./Icon.js";
import { safeMediaUrl } from "./media.js";
import type { WidgetPerson } from "./types.js";

export function Avatar({ name, avatarUrl, verified }: WidgetPerson) {
  const url = safeMediaUrl(avatarUrl);
  return (
    <span className="qb-avatar" title={name}>
      {url ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1)}</span>
      )}
      {verified && (
        <span className="qb-verified" aria-label="Team member">
          <Icon name="check" />
        </span>
      )}
    </span>
  );
}
