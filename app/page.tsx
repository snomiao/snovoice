"use client";
import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./globals.css";
import yaml from "yaml";
import * as Tone from "tone";
import { useHotkeys } from "react-hotkeys-hook";
import localforage from "localforage";
import useAsyncEffect from "use-async-effect";

const def = `
def:
  bpm 120: {}
- main:
    - 8n C3 D3 E3 F3 G3 A3 B3 C4
# for 8:
#   // - 4n C3 D3 E3 F3
#   // - 4n G3 A3 B3 C4
# for 4:
#   - 8n C3 D3 E3 F3 G3 A3 B3 C4
#   - ja say: SOMETHING
`;

export default function Home() {
  const [value, valueSet] = useLocalForageState("value", def);
  const [parsed, setParsed] = useState("...");
  const editorRef = useRef<Parameters<Parameters<typeof Editor>[0]["onMount"]>[0]>(null);
  const parse = debounce(() => {
    const text = editorRef.current.getValue() as string;
    try {
      const tree = yaml.parse(text);
      setParsed(yaml.stringify(tree));
    } catch (e) {}
  }, 100);
  useEffect(() => {
    parse();
  }, [value]);
  useAsyncEffect(() => {
    try {
      const tree = yaml.stringify(parsed) as any;
      const synth = new Tone.Synth().toDestination();
      tree.main.map((seq) => {
        seq.split(" ").map((note) => synth.triggerAttackRelease(note, "8n", "+0", 0.5));
      });
    } catch (e) {}
  }, [parsed]);
  const onSing = () => {
    // const tree = yaml.parse(input);
    // console.log(tree);
  };

  const onHear = () => {
    const constraints = { audio: true };
    let recordedChunks = [];

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const recordedBlob = new Blob(recordedChunks, { type: "audio/wav" });
          const audioContext = new AudioContext();
          const fileReader = new FileReader();
          fileReader.onload = () => {
            const arrayBuffer = fileReader.result as ArrayBuffer;
            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
              const source = audioContext.createBufferSource();
              source.buffer = buffer;

              // Modify the audio using Web Audio API
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 0.5;
              const convNode = audioContext.createConvolver();
              source.connect(gainNode);
              gainNode.connect(convNode);
              convNode.connect(audioContext.destination);

              // Play back the modified audio
              source.start(0);
            });
          };
          fileReader.readAsArrayBuffer(recordedBlob);
          recordedChunks = [];
        };
        // Record for 5 seconds
        setTimeout(() => {
          mediaRecorder.stop();
        }, 5000);
        mediaRecorder.start();
      })
      .catch(console.error);
  };
  return (
    <main className="w-[100vw] h-[100vh] col gap-8">
      <div className="flex-0">
        <h1 className="flex text-lg m-auto">
          <a className="text-9xl font-bold" href="https://voice.snomiao.com">
            snovoice
          </a>
        </h1>
      </div>
      <div className="long flex-1 ">
        <div className="short gap-4 flex-0">
          <button onClick={playSample}>Sample</button>
          <button onClick={onHear}>Hear</button>
          <button onClick={onSing}>Sing</button>
        </div>
        <div className="row flex-1 gap-4 w-full">
          <Editor
            className="flex-1 h-full w-full"
            defaultLanguage="yaml"
            defaultValue={def}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
            }}
            onChange={valueSet}
          />
          <pre className="flex-1 h-full w-full">{parsed}</pre>
        </div>
      </div>
    </main>
  );
}

function playSample() {
  const synth = new Tone.Synth().toDestination();
  "C3 D3 E3 F3 G3 A3 B3 C4".split(' ').map((note, i) => {
    synth.triggerAttackRelease(note, "8n", "+8n", 0.5);
  });
  // Create an AudioContext object
  // const audioContext = new AudioContext();

  // // Create an oscillator node
  // const oscillator = audioContext.createOscillator();

  // // Create a gain node to control the volume
  // const gainNode = audioContext.createGain();

  // // Connect the oscillator to the gain node
  // oscillator.connect(gainNode);

  // // Connect the gain node to the destination (your speakers)
  // gainNode.connect(audioContext.destination);

  // // Start the oscillator
  // oscillator.start();

  // // Ramp up the volume to 100 quickly
  // gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  // gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.1);

  // // Ramp down the volume slowly
  // gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);

  // // Stop the oscillator after 1.1 seconds
  // setTimeout(() => {
  //   oscillator.stop();
  // }, 1100);
}

function debounce(func: () => void, wait = 1000) {
  let timerId;
  return (...args) => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      func.apply(null, args);
    }, wait);
  };
}

function useLocalForageState<T>(name: string, defaultValue: T) {
  const [val, set] = useState(defaultValue);
  useEffect(() => {
    (async () => {
      const value = (await localforage.getItem(name)) as T;
      set(value);
    })();
  }, [defaultValue]);
  const setter = (value: T) => {
    localforage.setItem(name, value); // async
    set(value);
  };
  return [val, setter] as const;
}
