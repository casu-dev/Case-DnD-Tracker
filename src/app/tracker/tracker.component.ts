import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Creature, TrackerData } from '../models/tracker.model';

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

  onDisconnect(): void {
    this.disconnect.emit();
  }

  getCreatureClassString(creature: Creature): string {
    const staticClasses = 'flex items-center justify-between p-4 rounded-lg bg-stone-500/10 border transition-all duration-300';
    
    const dynamicClasses: string[] = [];
    if (creature.isActive) {
      dynamicClasses.push('border-amber-600', 'border-2', 'shadow-amber-600/30', 'shadow-lg', 'scale-105');
    } else {
      dynamicClasses.push('border-stone-400/50');
    }

    if (creature.woundInfo?.text === 'Defeated') {
      dynamicClasses.push('opacity-50');
    } else if (!creature.isActive) {
      dynamicClasses.push('opacity-75');
    }

    return `${staticClasses} ${dynamicClasses.join(' ')}`;
  }
}
