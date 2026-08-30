import { ComponentRef } from '@angular/core';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

/**
 * NgbModalRef doesn't expose the underlying component ref of dynamically opened content
 * through its public API - `_contentRef` is a private, undocumented field. This interface
 * describes just enough of that internal shape to retrieve the component ref for
 * `setInput()` calls.
 */
interface ContentRefHolder {
  _contentRef?: { componentRef?: ComponentRef<unknown> };
}

export function setModalInput(modalRef: NgbModalRef, name: string, value: unknown): void {
  const componentRef = (modalRef as unknown as ContentRefHolder)._contentRef?.componentRef;
  componentRef?.setInput(name, value);
}
