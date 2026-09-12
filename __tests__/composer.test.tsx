/**
 * ひとこと記録.
 *
 * The order is the product: you write first, and only then are you asked what
 * kind of thing it was. Everything after the body is optional.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Composer } from '@components/log/Composer';
import type { AntennaId } from '@/types';

const MONTH: AntennaId[] = ['progress', 'values'];

function setup(onSave = jest.fn(), antennaIds: AntennaId[] = MONTH) {
  render(
    <Composer
      periodKey="2026-09"
      occurredOn="2026-09-12"
      antennaIds={antennaIds}
      onSave={onSave}
    />
  );
  return onSave;
}

const write = (text: string) => fireEvent.changeText(screen.getByTestId('composer-body'), text);

describe('the order of the three steps', () => {
  it('asks nothing until something has been written', () => {
    setup();
    expect(screen.queryByTestId('composer-step-category')).toBeNull();
    expect(screen.queryByTestId('composer-step-detail')).toBeNull();
  });

  it('offers the kinds once there is something to describe', () => {
    setup();
    write('知らない街を歩いた');
    expect(screen.getByTestId('composer-step-category')).toBeTruthy();
    // The narrowing does not exist until a kind is chosen.
    expect(screen.queryByTestId('composer-step-detail')).toBeNull();
  });

  it('asks the chosen kind its own question', () => {
    setup();
    write('知らない街を歩いた');
    fireEvent.press(screen.getByTestId('category-progress_tried'));
    expect(screen.getByText(/何をやってみた？/)).toBeTruthy();
    expect(screen.getByTestId('detail-went')).toBeTruthy();
  });

  it('drops the narrowing when the kind changes under it', () => {
    setup();
    write('知らない街を歩いた');
    fireEvent.press(screen.getByTestId('category-progress_tried'));
    fireEvent.press(screen.getByTestId('detail-went'));
    fireEvent.press(screen.getByTestId('category-progress_did'));
    expect(screen.queryByTestId('detail-went')).toBeNull();
  });
});

describe('what the month is watching decides what is offered', () => {
  it('offers the categories of the two アンテナ chosen for the month', () => {
    setup(jest.fn(), ['progress', 'values']);
    write('x');
    expect(screen.getByTestId('category-progress_did')).toBeTruthy();
    expect(screen.getByTestId('category-values_important')).toBeTruthy();
    expect(screen.queryByTestId('category-spark_curious')).toBeNull();
  });

  it('offers every category when no direction has been set', () => {
    // Not having chosen what to watch is not a reason to be unable to write.
    setup(jest.fn(), []);
    write('x');
    expect(screen.getByTestId('category-progress_did')).toBeTruthy();
    expect(screen.getByTestId('category-spark_curious')).toBeTruthy();
  });
});

describe('saving', () => {
  it('keeps a record that was never tagged', () => {
    const onSave = setup();
    write('眠りが浅い日が続いている');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '眠りが浅い日が続いている',
        categoryId: null,
        detailId: null,
        periodKey: '2026-09',
      })
    );
  });

  it('keeps the kind and the narrowing when they were chosen', () => {
    const onSave = setup();
    write('知らない街を歩いた');
    fireEvent.press(screen.getByTestId('category-progress_tried'));
    fireEvent.press(screen.getByTestId('detail-went'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'progress_tried', detailId: 'went' })
    );
  });

  it('will not save an empty record', () => {
    const onSave = setup();
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('empties itself afterwards, so the next line starts clean', () => {
    const onSave = setup();
    write('ひとつめ');
    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByTestId('composer-body').props.value).toBe('');
    expect(screen.queryByTestId('composer-step-category')).toBeNull();
  });

  it('carries a record that has no day — only its month', () => {
    const onSave = jest.fn();
    render(
      <Composer periodKey="2025-03" occurredOn={null} antennaIds={MONTH} onSave={onSave} />
    );
    fireEvent.changeText(screen.getByTestId('composer-body'), '去年の三月のこと');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ occurredOn: null, periodKey: '2025-03' })
    );
  });
});
