import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SAMPLES, SampleReceipt } from '../../core/demo/samples';
import { ScanStore } from '../../core/scan.store';
import { PROVIDERS, SettingsStore } from '../../core/settings.store';

@Component({
  selector: 'app-scan',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scan.page.html',
  styleUrl: './scan.page.scss',
})
export class ScanPage implements OnDestroy {
  protected readonly scan = inject(ScanStore);
  protected readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly samples = SAMPLES;
  protected readonly dragging = signal(false);
  protected readonly busy = computed(() => this.scan.status() === 'preparing' || this.scan.status() === 'extracting');
  protected readonly providerName = computed(() => PROVIDERS.find((p) => p.id === this.settings.provider())!.label.split(' (')[0]);

  constructor() {
    if (this.scan.status() === 'error') this.scan.cancel();
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.handle(this.scan.scanFile(file));
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.dragging.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await this.handle(this.scan.scanFile(file));
  }

  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(true);
  }

  protected async useSample(s: SampleReceipt): Promise<void> {
    await this.handle(this.scan.scanSample(s));
  }

  protected manual(): void {
    this.scan.startManual();
    this.router.navigate(['/review']);
  }

  private async handle(result: Promise<boolean>): Promise<void> {
    if (await result) this.router.navigate(['/review']);
  }

  ngOnDestroy(): void {
    if (this.busy()) this.scan.cancel();
  }
}
