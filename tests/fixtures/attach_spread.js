// The attachment key the spreads of `AttachSpread*.svelte` hand an attachment
// under, and what `AttachSpreadHost.svelte` caught: whether each error was an
// `Error`.
import { createAttachmentKey } from 'svelte/attachments';

export const key = createAttachmentKey();
export const caught = [];
