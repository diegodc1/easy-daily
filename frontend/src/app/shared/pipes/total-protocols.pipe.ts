import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'totalProtocols', standalone: true })
export class TotalProtocolsPipe implements PipeTransform {
  transform(value: number): number {
    return value || 0;
  }
}
