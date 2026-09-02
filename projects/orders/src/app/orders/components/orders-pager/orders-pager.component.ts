import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ord-orders-pager',
  imports: [DecimalPipe],
  templateUrl: './orders-pager.component.html',
  styleUrl: './orders-pager.component.scss',
})
export class OrdersPagerComponent {
  static pageSizes: readonly number[] = [10, 25, 50];

  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();

  pageChange = output<number>();
  pageSizeChange = output<number>();

  pageSizeOptions = OrdersPagerComponent.pageSizes;

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));

  rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  canGoPrev = computed(() => this.page() > 1);
  canGoNext = computed(() => this.page() < this.totalPages());

  onPrev(): void {
    if (this.canGoPrev()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  onNext(): void {
    if (this.canGoNext()) {
      this.pageChange.emit(this.page() + 1);
    }
  }

  onPageSizeChange(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
