/**
 * 音声で入力.
 *
 * The door is here before what is behind it. What matters is that pressing it
 * says something: a control that does nothing at all reads as broken, and a
 * greyed one teaches nothing about what is coming.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { VoiceEntry } from '@components/ui/VoiceEntry';

describe('the voice door', () => {
  it('is offered, and says nothing until asked', () => {
    render(<VoiceEntry />);
    expect(screen.getByTestId('voice-entry')).toBeTruthy();
    expect(screen.queryByText('音声はまだ入っていません')).toBeNull();
  });

  it('tells the truth when pressed, rather than doing nothing', () => {
    render(<VoiceEntry />);
    fireEvent.press(screen.getByTestId('voice-entry'));
    expect(screen.getByText('音声はまだ入っていません')).toBeTruthy();
  });
});
