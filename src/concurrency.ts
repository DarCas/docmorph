/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

type Waiter = {
    resolve: () => void
}

export class Semaphore {
    private readonly max: number

    private active = 0

    private readonly waiters: Waiter[] = []

    constructor(max: number) {
        this.max = Math.max(1, Math.floor(max))
    }

    get activeCount(): number {
        return this.active
    }

    get queuedCount(): number {
        return this.waiters.length
    }

    get maxCount(): number {
        return this.max
    }

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

    private release(): void {
        this.active = Math.max(0, this.active - 1)

        const next = this.waiters.shift()

        if (next) {
            this.active += 1
            next.resolve()
        }
    }
}
