import { ChangeDetectionStrategy, Component, input, output, effect } from '@angular/core';
import { TrackerData } from '../../models/tracker.model';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [],
  templateUrl: './tracker.component.html',
  styleUrls: ['./tracker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackerComponent {
  trackerData = input.required<TrackerData>();
  disconnect = output<void>();

  private lastActiveCreatureId: string | undefined;

  constructor() {
    effect(() => {
      const data = this.trackerData();
      if (!data) return;

      const activeCreature = data.creatures.find(c => c.isActive);
      const newActiveId = activeCreature?.id;

      // Scroll to the active creature if it's new or different from the last one.
      // This handles both initial load and subsequent turn changes.
      if (newActiveId && newActiveId !== this.lastActiveCreatureId) {
        this.lastActiveCreatureId = newActiveId;

        // We need to wait for the DOM to be updated by Angular's rendering.
        // A `setTimeout` with a 0ms delay defers the execution until after the
        // current browser tick, ensuring the element is available.
        setTimeout(() => {
          const element = document.getElementById(`creature-${newActiveId}`);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 0);
      } else if (!newActiveId && this.lastActiveCreatureId) {
        // Reset if there's no longer an active creature.
        this.lastActiveCreatureId = undefined;
      }
    });
  }

  onDisconnect(): void {
    this.disconnect.emit();
  }

  getHpBarColor(current: number | null, max: number | null): string {
    if (current === null || max === null || max === 0) {
      return 'bg-stone-400'; // Default for unknown HP
    }
    const percentage = current / max;
    if (percentage > 0.5) {
      return 'bg-green-600';
    }
    if (percentage > 0.25) {
      return 'bg-yellow-500';
    }
    return 'bg-red-700';
  }
}