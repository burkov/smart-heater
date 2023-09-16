'use strict';

import {existsSync} from 'fs';
import {openSync} from 'i2c-bus';

// Addresses
const ADDR_RGB = 0x62;
const ADDR_LCD = 0x3e;

// Registers
const REG_MODE1 = 0x00;
const REG_MODE2 = 0x01;
const REG_RATIO = 0x06;
const REG_PERIOD = 0x07;
const REG_OUTPUT = 0x08;

const Color = {
  Blue: 0x02,
  Green: 0x03,
  Red: 0x04,
};

// Commands
const CLEAR_DISPLAY = 0x01;
const RETURN_HOME = 0x02;
const ENTRY_MODE_SET = 0x04;
const DISPLAY_CONTROL = 0x08;
const CURSOR_SHIFT = 0x10;
const FUNCTION_SET = 0x20;
const SET_CGRAM_ADDR = 0x40;
const SET_DDRAM_ADDR = 0x80;

// Display entry mode flags
// const ENTRY_RIGHT          = 0x00;
const ENTRY_SHIFT_DECREMENT = 0x00;
const ENTRY_SHIFT_INCREMENT = 0x01;
const ENTRY_LEFT = 0x02;

// flags for display on/off control
const BLINK_OFF = 0x00;
const CURSOR_OFF = 0x00;
const DISPLAY_OFF = 0x00;
const BLINK_ON = 0x01;
const CURSOR_ON = 0x02;
const DISPLAY_ON = 0x04;

// Display/cursor shift flags
const MOVE_LEFT = 0x00;
const CURSOR_MOVE = 0x00;
const MOVE_RIGHT = 0x04;
const DISPLAY_MOVE = 0x08;

// Function set flags
// const 8_BIT_MODE = 0x10;
// const 4_BIT_MODE = 0x00;

const Lines = {
  One: 0x00,
  Two: 0x08,
};

const CharacterSize = {
  _5x8: 0x00,
  _5x10: 0x04,
};

const I2C_0 = '/dev/i2c-0';
const I2C_1 = '/dev/i2c-1';
const I2C_2 = '/dev/i2c-2';

function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

const command = Symbol();
const displayControl = Symbol();
const displayFunction = Symbol();
const displayMode = Symbol();
const setReg = Symbol();
const write = Symbol();
const writeBytes = Symbol();
const writeByteSync = Symbol();

export class GroveLCDRGB {
  constructor({ characterSize = CharacterSize._5x8, lines = Lines.Two } = {}) {
    let busNumber;
    if (existsSync(I2C_0)) busNumber = 0;
    else if (existsSync(I2C_1)) busNumber = 1;
    else if (existsSync(I2C_2)) busNumber = 2;
    else throw new Error('Failed to find I2C device');

    const bus = openSync(busNumber);

    this[writeByteSync] = bus.writeByteSync.bind(bus);

    this[command] = bus.writeByteSync.bind(bus, ADDR_LCD, SET_DDRAM_ADDR);

    this[writeBytes] = bus.i2cWriteSync.bind(bus, ADDR_LCD);

    this[write] = bus.writeByteSync.bind(bus, ADDR_LCD, SET_CGRAM_ADDR);

    this[setReg] = bus.writeByteSync.bind(bus, ADDR_RGB);

    this[displayFunction] = characterSize | lines;

    this[command](FUNCTION_SET | this[displayFunction]);

    // turn the display on with no cursor or blinking default
    this[displayControl] = DISPLAY_ON | BLINK_OFF | CURSOR_OFF;
    this.on();

    // clear display
    this.clear();

    this.blinkLEDOff();

    // Initialize to default text direction (for romance languages)
    this[displayMode] = ENTRY_LEFT | ENTRY_SHIFT_DECREMENT;
    // Set the entry mode
    this[command](ENTRY_MODE_SET | this[displayMode]);

    // Initialize backlight
    this[setReg](REG_MODE1, 0);
    // Set LEDs controllable by both PWM and GRPPWM registers
    this[setReg](REG_OUTPUT, 0xff);
    // Set MODE2 values
    // 0010 0000 -> 0x20  (DMBLNK to 1, i.e. blinky mode)
    this[setReg](REG_MODE2, 0x20);

    this.setRGB(255, 255, 255);
  }

  /**
   * Turn the display on.
   */
  on() {
    this[displayControl] |= DISPLAY_ON;
    this[command](DISPLAY_CONTROL | this[displayControl]);
  }

  /**
   * Turn the display off.
   */
  off() {
    this[displayControl] &= ~DISPLAY_ON;
    this[command](DISPLAY_CONTROL | DISPLAY_OFF);
  }

  /**
   * Clear text from display.
   */
  clear() {
    this[command](CLEAR_DISPLAY);
  }

  /**
   * Turn the cursor blinking on.
   */
  blinkOn() {
    this[displayControl] |= BLINK_ON;
    this[command](DISPLAY_CONTROL | this[displayControl]);
  }

  /**
   * Turn the cursor blinking off.
   */
  blinkOff() {
    this[displayControl] &= ~BLINK_ON;
    this[command](DISPLAY_CONTROL | this[displayControl]);
  }

  /**
   * Turn the cursor on.
   */
  cursorOn() {
    this[displayControl] |= CURSOR_ON;
    this[command](DISPLAY_CONTROL | this[displayControl]);
  }

  /**
   * Turn the cursor off.
   */
  cursorOff() {
    this[displayControl] &= ~CURSOR_ON;
    this[command](DISPLAY_CONTROL | this[displayControl]);
  }

  /**
   * Move cursor left.
   */
  cursorLeft() {
    this[command](CURSOR_SHIFT | CURSOR_MOVE | MOVE_LEFT);
  }

  /**
   * Move cursor right.
   */
  cursorRight() {
    this[command](CURSOR_SHIFT | CURSOR_MOVE | MOVE_RIGHT);
  }

  /**
   * Set the location at which subsequent written text will be displayed to
   * column 0, row 0.
   */
  home() {
    this[command](RETURN_HOME);
  }

  /**
   * Set the location at which subsequent written text will be displayed.
   * @param {number} col
   * @param {number} row
   */
  setCursor(col, row) {
    this[command](row === 0 ? col | 0x80 : col | 0xc0);
  }

  // This will 'right justify' text from the cursor
  autoscrollOn() {
    this[displayMode] |= ENTRY_SHIFT_INCREMENT;
    this[command](ENTRY_MODE_SET | this[displayMode]);
  }

  // This will 'left justify' text from the cursor
  autoscrollOff() {
    this[displayMode] &= ~ENTRY_SHIFT_INCREMENT;
    this[command](ENTRY_MODE_SET | this[displayMode]);
  }

  // These commands scroll the display without changing the RAM
  scrollLeft() {
    this[command](CURSOR_SHIFT | DISPLAY_MOVE | MOVE_LEFT);
  }

  scrollRight() {
    this[command](CURSOR_SHIFT | DISPLAY_MOVE | MOVE_RIGHT);
  }

  /**
   * Flow text from left to right. Default mode.
   */
  leftToRight() {
    this[displayMode] |= ENTRY_LEFT;
    this[command](ENTRY_MODE_SET | this[displayMode]);
  }

  /**
   * Flow text from right to left
   */
  rightToLeft() {
    this[displayMode] &= ~ENTRY_LEFT;
    this[command](ENTRY_MODE_SET | this[displayMode]);
  }

  /**
   * Control the backlight LED blinking.
   * @param {number} ratio Blink ratio. On time in 1/256 of a second.
   */
  blinkLEDOn(ratio = 0x7f) {
    // blink period in seconds = (<reg 7> + 1) / 24
    // blink every second
    this[setReg](REG_PERIOD, 0x17);

    // on/off ratio = <reg 6> / 256
    this[setReg](REG_RATIO, ratio);
  }

  /**
   * Turn off backlight LED blinking.
   */
  blinkLEDOff() {
    this[setReg](REG_PERIOD, 0x00);
    this[setReg](REG_RATIO, 0xff);
  }

  createChar(location, charmap) {
    // There are only 8 locations: 0-7
    this[command](SET_CGRAM_ADDR | ((location & 0x07) << 3));
    this[writeBytes](9, Buffer.from([SET_CGRAM_ADDR, ...charmap]));
  }

  /**
   * Set backlight LED to specified color.
   * @param {number} red Red component.
   * @param {number} green Green component.
   * @param {number} blue Blue component.
   */
  setRGB(red, green, blue) {
    this[setReg](Color.Red, red);
    this[setReg](Color.Green, green);
    this[setReg](Color.Blue, blue);
  }

  setPWM(color, pwm) {
    return this[setReg](color, pwm);
  }

  /**
   * Print text to the display without any additional formatting.
   * @param {*} text Text to print.
   */
  setTextRaw(text) {
    return [...text].map((x) => this[write](x.charCodeAt(0)));
  }

  setText(text) {
    this.clear();

    sleep(5).then(() => {
      const lines = text
        // take first 2 lines if any
        .split('\n')
        .slice(0, 2)
        // split lines into two 16 character chunks
        .map((l) => [l.slice(0, 16), l.slice(16, 32)])
        .reduce((a, b) => {
          a.push(...b);
          return a;
        }, [])
        // filter out empty lines
        .filter((a) => a !== '')
        // take first two lines
        .slice(0, 2);

      this.setTextRaw(lines[0]);

      if (lines[1] != null && lines[1] !== '') {
        this.setCursor(0, 1);
        this.setTextRaw(lines[1]);
      }
    });
  }
}
