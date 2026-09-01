import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ord-orders-pager',
  imports: [DecimalPipe],
  templateUrl: './orders-pager.html',
  styleUrl: './orders-pager.scss',
})
export class OrdersPager {
  static readonly pageSizes: readonly number[] = [10, 25, 50];

  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageSizeOptions = OrdersPager.pageSizes;

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  protected readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );

  protected readonly rangeEnd = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total()),
  );

  protected readonly canGoPrev = computed(() => this.page() > 1);
  protected readonly canGoNext = computed(() => this.page() < this.totalPages());

  protected onPrev(): void {
    if (this.canGoPrev()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  protected onNext(): void {
    if (this.canGoNext()) {
      this.pageChange.emit(this.page() + 1);
    }
  }

  protected onPageSizeChange(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
