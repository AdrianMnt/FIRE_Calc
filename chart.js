'use strict';

class ProjectionChart {
    constructor({ canvas, tooltip, reading, legend, controls, series, age, gbp }) {
        Object.assign(this, { canvas, tooltip, reading, legend, controls, series, age, gbp });
        this.view = 'balances';
        this.month = null;
        this.compact = new Intl.NumberFormat('en-GB', {
            style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
        });
        this.buttons = [...controls.querySelectorAll('button')];
        for (const button of this.buttons) {
            button.addEventListener('click', () => {
                this.view = button.dataset.view;
                this.refresh();
            });
        }
        const inspect = event => {
            if (!this.layout || !this.data) return;
            const offset = event.clientX - canvas.getBoundingClientRect().left;
            const { left, right, last } = this.layout;
            this.select(Math.round((offset - left) / (right - left) * last), event.type === 'pointerdown');
        };
        canvas.addEventListener('pointermove', event => {
            if (event.pointerType === 'mouse') inspect(event);
        });
        canvas.addEventListener('pointerdown', inspect);
        canvas.addEventListener('pointerleave', event => {
            if (event.pointerType === 'mouse' && document.activeElement !== canvas) this.select(null);
        });
        canvas.addEventListener('focus', () => this.select(this.month ?? 0, true));
        canvas.addEventListener('blur', () => this.select(null));
        canvas.addEventListener('keydown', event => {
            const last = this.data?.rows.at(-1)?.month;
            if (last === undefined) return;
            const steps = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 };
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? last
                : event.key in steps ? (this.month ?? 0) + steps[event.key] : null;
            if (next === null) return;
            event.preventDefault();
            this.select(next, true);
        });
        new ResizeObserver(() => this.draw()).observe(canvas);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
    }

    update(data) {
        this.data = data;
        this.month = null;
        this.announce('');
        if (!data.stress && this.view === 'stress') this.view = 'balances';
        this.refresh();
    }

    refresh() {
        for (const button of this.buttons) {
            button.disabled = button.dataset.view === 'stress' && !this.data.stress;
            button.setAttribute('aria-pressed', String(button.dataset.view === this.view));
        }
        this.legend.replaceChildren(...this.lines().map(([, label, colour]) => this.key(label, colour)));
        if (this.view === 'stress') this.legend.append(this.key('Middle 80% of funded paths', '--band'));
        this.draw();
    }

    key(label, colour) {
        const item = document.createElement('span');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = `var(${colour})`;
        item.append(swatch, document.createTextNode(label));
        return item;
    }

    lines() {
        if (this.view === 'mortgage') return this.series.filter(([key]) => key === 'mortgage');
        if (this.view === 'stress') return [['portfolio', 'Baseline portfolio', '--isa']];
        return this.series;
    }

    showMonth(month) {
        if (this.view !== 'balances') {
            this.view = 'balances';
            this.refresh();
        }
        this.canvas.focus();
        this.select(month, true);
        this.canvas.scrollIntoView({ block: 'nearest' });
    }

    select(month, speak = false) {
        if (!this.data) return;
        const last = this.data.rows.at(-1).month;
        const selected = month === null ? null : Math.max(0, Math.min(last, month));
        if (selected !== this.month) {
            this.month = selected;
            this.draw();
        }
        if (speak) this.announce(this.tooltip.innerText);
    }

    announce(text) {
        this.reading.textContent = text;
    }

    draw() {
        const { canvas, data } = this;
        if (!data || canvas.clientWidth < 100 || canvas.clientHeight < 100) return;
        const { rows, stress, mortgageFree, start } = data;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        const css = getComputedStyle(document.documentElement);
        const color = variable => css.getPropertyValue(variable).trim();
        const left = 59;
        const right = width - 25;
        const top = 30;
        const bottom = height - 29;
        const last = rows.at(-1).month;
        this.layout = { left, right, last };
        const x = month => left + month / Math.max(1, last) * (right - left);
        const lines = this.lines();
        const bands = this.view === 'stress' ? stress.ranges : [];
        const values = rows.flatMap(row => lines.map(([key]) => row[key]));
        const low = Math.min(0, ...values);
        const high = Math.max(low + 1, ...values, ...bands.map(band => band.high ?? 0));
        const y = value => bottom - (value - low) / (high - low) * (bottom - top);
        const segment = (x1, y1, x2, y2) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        };

        ctx.font = '12px system-ui';
        ctx.textAlign = 'right';
        ctx.fillStyle = color('--muted');
        ctx.strokeStyle = color('--line');
        for (let i = 0; i <= 4; i++) {
            const value = low + i * (high - low) / 4;
            segment(left, y(value), right, y(value));
            ctx.fillText(this.compact.format(value), left - 6, y(value) + 4);
        }
        ctx.textAlign = 'center';
        const ticks = Math.min(width < 520 ? 3 : 5, last);
        for (let tick = 0; tick <= ticks; tick++) {
            const row = rows[Math.round(tick * last / Math.max(1, ticks))];
            ctx.fillText(this.age(row.age), x(row.month), height - 7);
        }

        if (bands.length) {
            const funded = rows.filter(row => bands[row.month].surviving > 0);
            if (funded.length) {
                ctx.beginPath();
                funded.forEach(row => ctx.lineTo(x(row.month), y(bands[row.month].high)));
                funded.reverse().forEach(row => ctx.lineTo(x(row.month), y(bands[row.month].low)));
                ctx.closePath();
                ctx.fillStyle = color('--band');
                ctx.fill();
            }
        }

        if (start !== undefined && start > 0 && this.view !== 'mortgage') {
            ctx.strokeStyle = color('--line');
            ctx.setLineDash([3, 4]);
            segment(x(start), top, x(start), bottom);
            ctx.setLineDash([]);
        }

        for (const [key, , variable] of lines) {
            ctx.strokeStyle = color(variable);
            ctx.lineWidth = 2;
            ctx.beginPath();
            const visible = key === 'mortgage' && mortgageFree
                ? rows.slice(0, mortgageFree.month + 1) : rows;
            for (const row of visible) ctx.lineTo(x(row.month), y(row[key]));
            ctx.stroke();
            if (visible.length === 1) this.dot(ctx, x(0), y(visible[0][key]), color(variable));
        }

        if (mortgageFree && this.view !== 'stress') {
            const marker = x(mortgageFree.month);
            ctx.strokeStyle = color('--mortgage');
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            segment(marker, 21, marker, y(0));
            ctx.setLineDash([]);
            this.dot(ctx, marker, y(0), color('--mortgage'));
            ctx.fillStyle = color('--mortgage');
            ctx.font = '600 12px system-ui';
            ctx.textAlign = 'left';
            const label = `Mortgage cleared · ${this.age(mortgageFree.age)}`;
            ctx.fillText(label, Math.max(4, Math.min(marker + 7, width - ctx.measureText(label).width - 4)), 15);
        }

        const row = this.month === null ? null : rows[this.month];
        this.tooltip.hidden = !row;
        if (!row) return;
        const crosshair = x(row.month);
        ctx.strokeStyle = color('--muted');
        ctx.lineWidth = 1;
        segment(crosshair, top, crosshair, bottom);
        for (const [key, , variable] of lines) this.dot(ctx, crosshair, y(row[key]), color(variable));
        this.showReading(row, lines, bands[row.month], crosshair, width);
    }

    dot(ctx, x, y, colour) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();
    }

    showReading(row, lines, band, crosshair, width) {
        const title = document.createElement('strong');
        const phase = this.data.rows[row.month + 1]?.phase ?? row.phase;
        title.textContent = `Age ${this.age(row.age)}${phase ? ' · ' + phase : ''}`;
        const values = lines.map(([key, label, colour]) => {
            const line = this.key(label, colour);
            const amount = document.createElement('b');
            amount.textContent = this.gbp(row[key]);
            line.append(amount);
            return line;
        });
        this.tooltip.replaceChildren(title, ...values);
        if (this.data.mortgageFree?.month === row.month) this.tooltip.append('Mortgage cleared');
        if (band?.surviving) this.tooltip.append(
            `${this.gbp(band.low)} to ${this.gbp(band.high)} · ${band.surviving} funded paths`
        );
        this.tooltip.style.left = Math.max(0, Math.min(width - this.tooltip.offsetWidth,
            crosshair + (crosshair > width / 2 ? -this.tooltip.offsetWidth - 12 : 12))) + 'px';
    }
}
