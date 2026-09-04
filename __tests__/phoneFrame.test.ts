import {
  PHONE_MAX_HEIGHT,
  PHONE_MAX_WIDTH,
  platePlan,
} from '../components/ui/PhoneFrame';

describe('the web app is held to a phone', () => {
  it('does not frame a window that is already phone-sized', () => {
    expect(platePlan(390, 844)).toBeNull();
    expect(platePlan(PHONE_MAX_WIDTH, 900)).toBeNull();
  });

  it('never gives the app more width than a phone has', () => {
    for (const windowWidth of [441, 768, 1280, 1920, 3440]) {
      const plate = platePlan(windowWidth, 1000);
      expect(plate).not.toBeNull();
      expect(plate?.width).toBe(PHONE_MAX_WIDTH);
    }
  });

  it('uses the window height when it is shorter than a phone', () => {
    expect(platePlan(1440, 700)?.height).toBe(700);
  });

  it('stops growing once the window is taller than a phone', () => {
    expect(platePlan(1440, 2000)?.height).toBe(PHONE_MAX_HEIGHT);
  });
});
