import { describe, it, expect } from 'vitest';
import { stripToTextWithBreaks } from '../index';

// Fallback used when DOMParser is unavailable/failing (some JCEF builds). The
// old behavior stripped every tag and collapsed the changelog into one run-on
// paragraph; these tests pin the line-structure-preserving replacement.
describe('stripToTextWithBreaks', () => {
  it('turns block boundaries into <br> and list items into bullets, dropping tags', () => {
    const html =
      '<h3>0.25.2 - Title</h3>\n<ul>\n<li>First item</li>\n<li>Second item</li>\n</ul>';
    const out = stripToTextWithBreaks(html);

    expect(out).not.toMatch(/<h3|<ul|<li/); // tags gone
    expect(out).toContain('0.25.2 - Title'); // heading text kept
    expect(out).toContain('• First item');
    expect(out).toContain('• Second item');
    expect(out).toContain('<br>'); // line structure preserved
    expect((out.match(/<br>/g) ?? []).length).toBeGreaterThanOrEqual(2); // not one run-on line
  });

  it('does not let raw markup execute (tags stripped, text escaped)', () => {
    const out = stripToTextWithBreaks('<p>hello <script>alert(1)</script> world</p>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('hello');
    expect(out).toContain('world');
  });

  it('collapses runs of blank lines', () => {
    const out = stripToTextWithBreaks('<p>a</p><p></p><p></p><p></p><p>b</p>');
    expect(out).not.toMatch(/(<br>){3,}/);
  });
});
