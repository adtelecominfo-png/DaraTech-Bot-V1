'use strict';
/**
 * lib/muteState.js
 * Shared mute state — single source of truth used by mute-user and unmute-user.
 * Keeping it in lib/ means neither command file has to import the other.
 */

/** Map<jid, { expiry: number|null, groupId: string }> */
const mutedUsers = new Map();

/**
 * Returns true if the JID is currently muted in the given group.
 * Automatically cleans up expired entries.
 */
function isUserMuted(jid, groupId) {
    const entry = mutedUsers.get(jid);
    if (!entry || entry.groupId !== groupId) return false;
    if (entry.expiry && Date.now() > entry.expiry) {
        mutedUsers.delete(jid);
        return false;
    }
    return true;
}

module.exports = { mutedUsers, isUserMuted };
