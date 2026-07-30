class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(Math.round(sampleRate / 10));
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    let inputOffset = 0;
    while (inputOffset < input.length) {
      const available = this.buffer.length - this.offset;
      const length = Math.min(available, input.length - inputOffset);
      this.buffer.set(input.subarray(inputOffset, inputOffset + length), this.offset);
      this.offset += length;
      inputOffset += length;

      if (this.offset === this.buffer.length) {
        const pcm = new Int16Array(this.buffer.length);
        let squared = 0;

        for (let index = 0; index < this.buffer.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, this.buffer[index]));
          pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          squared += sample * sample;
        }

        this.port.postMessage(
          {
            pcm: pcm.buffer,
            level: Math.sqrt(squared / this.buffer.length),
          },
          [pcm.buffer],
        );
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
