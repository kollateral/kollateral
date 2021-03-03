export const second = 1;
export const minute = 60 * second;
export const hour = 60 * minute;
export const day = 24 * hour;
export const year = 365 * day;

export function getUnixTimestamp(): number {
	return Math.round(Date.now().valueOf() / 1000);
}

export function futureTimestamp(time: number): number {
	return getUnixTimestamp() + time;
}
