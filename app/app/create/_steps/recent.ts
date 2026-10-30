/** The last few photos the user added, to pick again with one tap: they come from the account (every device sees them).
    They used to be copied into localStorage as whole pictures too, which filled the browser's 5 MB. */
export type Recent = { d: string; w: number; h: number; id?: string };
