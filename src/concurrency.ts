/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Bounded-concurrency primitive guarding simultaneous LibreOffice conversions.
 *
 * The semaphore hands out at most {@link Semaphore.maxCount} slots. Acquirers
 * beyond capacity wait in FIFO order until a holder releases its slot. Every
 * acquired slot must be released, ideally in a `finally` block, otherwise the
 * pool leaks and throughput degrades to zero.
 *
 * @example
 * ```ts
 * const release = await pool.acquire()
 *
 * try {
 *     await convertDocxToPdf(buffer, name, { timeoutMs: 60_000 })
 * } finally {
 *     release()
 * }
 * ```
 */
type Waiter = {
    /** Resolves the queued acquirer when a slot becomes available. */
    resolve: () => void
}

/**
 * FIFO counting semaphore with a fixed maximum number of concurrent slots.
 */
export class Semaphore {
    /** Maximum number of slots that may be held simultaneously. Always >= 1. */
    private readonly max: number

    /** Number of slots currently held. */
    private active = 0

    /** FIFO queue of acquirers waiting for a free slot. */
    private readonly waiters: Waiter[] = []

    /**
     * Creates a semaphore with the given capacity.
     *
     * Non-integer values are floored and values below 1 are clamped to 1,
     * so the pool can never be constructed in an unusable state.
     *
     * @param max - Maximum number of concurrent slots.
     */
    constructor(max: number) {
        this.max = Math.max(1, Math.floor(max))
    }

    /**
     * Number of slots currently held.
     *
     * @returns The active holder count.
     */
    get activeCount(): number {
        return this.active
    }

    /**
     * Number of acquirers currently waiting for a slot.
     *
     * @returns The queued waiter count.
     */
    get queuedCount(): number {
        return this.waiters.length
    }

    /**
     * Maximum number of slots this semaphore will grant.
     *
     * @returns The configured capacity.
     */
    get maxCount(): number {
        return this.max
    }

    /**
     * Acquires a slot, waiting in FIFO order when the pool is exhausted.
     *
     * Resolves immediately while capacity remains, otherwise parks the caller
     * until a previous holder releases.
     *
     * @returns A release function that must be called exactly once, ideally
     * in a `finally` block, to hand the slot to the next waiter.
     */
    async acquire(): Promise<() => void> {
        if (this.active < this.max) {
            this.active += 1
            return this.release.bind(this)
        }

        await new Promise<void>(resolve => {
            this.waiters.push({resolve})
        })

        return this.release.bind(this)
    }

    /**
     * Releases one held slot and wakes the longest-waiting acquirer, if any.
     *
     * The woken waiter inherits the freed slot directly, so the active count
     * stays constant during handover instead of dipping.
     */
    private release(): void {
        this.active = Math.max(0, this.active - 1)

        const next = this.waiters.shift()

        if (next) {
            this.active += 1
            next.resolve()
        }
    }
}
