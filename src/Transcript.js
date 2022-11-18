import { Deepgram } from "@deepgram/sdk/browser";
import React, { useEffect, useState, useRef } from "react";
import quotes from "./quotes.json";
import tongueTwisters from "./twisters.json";
import lyrics from "./lyrics.json";
import Footer from './footer'

export function Transcript() {
  let score = 0;
  const MILLIS_PER_SECOND = 1000;
  const SECONDS_PER_MINUTE = 60;
  let gameOver = false;
  let phraseSpoken = "";

  function getTongueTwister() {
    return tongueTwisters[Math.floor(Math.random() * tongueTwisters.length)];
  }

  function getQuote() {
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  function getLyric() {
    return lyrics[Math.floor(Math.random() * lyrics.length)];
  }

  function startRecording(recorderRef) {
    if (recorderRef.current && recorderRef.current.state === "inactive")
      recorderRef.current.start(500);
  }

  function stopRecording(recorderRef) {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function clickedQuotes() {
    setCategory("quotes");
    getNewQuote();
    getNewSentence.current = getNewQuote;
  }

  function clickedLyrics() {
    setCategory("lyrics");
    getNewLyric();
    getNewSentence.current = getNewLyric;
  }

  function clickedTongueTwisters() {
    setCategory("twisters");
    getNewTongueTwister();
    getNewSentence.current = getNewTongueTwister;
  }

  function getNewQuote() {
    const newSentence = getQuote();
    sentenceRef.current = newSentence;
    setSentence(newSentence);
  }

  function getNewLyric() {
    const newSentence = getLyric();
    sentenceRef.current = newSentence;
    setSentence(newSentence);
  }

  function getNewTongueTwister() {
    const newSentence = getTongueTwister();
    sentenceRef.current = newSentence;
    setSentence(newSentence);
  }

  function play() {
    setCountdown(3);
    setTimeout(() => {
      setPlaying(true);
      startNewChallenge();
    }, 2750);
  }

  function onSocketMessage(message) {
    const received = JSON.parse(message.data);
    try {
      const transcript = received.channel.alternatives[0].transcript;
      if (transcript && received.is_final) {
        finalTranscript.current += " " + transcript;
        setLatestTranscript(finalTranscript.current);
      }
      if (transcript) {
        fullTranscript.current += " " + transcript;
        setCombinedTranscript(fullTranscript.current);
      }
    } catch {
      openSocket.current = false;
    }
  }

  async function onDataAvailable(event) {
    if (event.data.size > 0 && dgSocket.current.readyState === 1) {
      dgSocket.current.send(event.data);
    }
  }

  function startSocketAndRecording(socketRef, recorderRef) {
    openSocket.current = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const socket = deepgram.transcription.live({ tier: "enhanced", tag: "speechracer", interim_results: true });
      socket.onopen = () => {
        startRecording(recorderRef);
      };
      socket.onclose = () => {
        openSocket.current = false;
      };
      socket.onmessage = onSocketMessage;

      const initRecorder = new MediaRecorder(stream);
      initRecorder.addEventListener("dataavailable", onDataAvailable);
      recorderRef.current = initRecorder;

      socketRef.current = socket;
    });
  }

  function closeSocketAndRecording(socketRef, recorderRef) {
    openSocket.current = false;
    stopRecording(recorderRef);
    if (socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.send(new Blob(new Uint8Array(0)));
    }
  }

  function startNewChallenge() {
    if (!openSocket.current) {
      startSocketAndRecording(dgSocket, recorder);
    }
    getNewSentence.current();
    setWords(
      sentenceRef.current.split(" ").map((w) => ({
        word: w,
        matched: false,
      }))
    );
    finalTranscript.current = "";
    fullTranscript.current = "";
    setLatestTranscript(finalTranscript.current);
    setStartTime(Date.now());
    setInChallenge(true);
    setWpm(0);
    setAccuracy(0);
    setDuration(0);
  }

  function stop() {
    closeSocketAndRecording(dgSocket, recorder);
    const stopTime = Date.now();
    setInChallenge(false);
    const durationSeconds = (stopTime - startTime) / MILLIS_PER_SECOND;
    setDuration(Math.round(durationSeconds, 1));
  }

  function processText(s) {
    return s
      .trim()
      .toLowerCase()
      .replace(/[,'.:;?]/g, "");
  }

  const deepgram = new Deepgram("");

  const [latestTranscript, setLatestTranscript] = useState("");
  const [combinedTranscript, setCombinedTranscript] = useState("");
  const [accuracy, setAccuracy] = useState(0);
  const [sentence, setSentence] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inChallenge, setInChallenge] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wpm, setWpm] = useState(0);
  const fullTranscript = useRef("");
  const finalTranscript = useRef("");
  const recorder = useRef(undefined);
  const dgSocket = useRef(undefined);
  const openSocket = useRef(false);
  const sentenceRef = useRef("");
  // Can change the default category here
  const getNewSentence = useRef(getNewQuote);
  const [category, setCategory] = useState("quotes");
  const [words, setWords] = useState([]);

  useEffect(() => {
    if (countdown > 0) setTimeout(() => setCountdown(countdown - 1), 1000);
    else if (countdown === 0) startNewChallenge();
  }, [countdown]);

  useEffect(() => {
    if (fullTranscript.current == "") {
      return;
    }

    let spokenWords = processText(fullTranscript.current).split(" ");
    let targetWords = sentenceRef.current.split(" ").map(function (tw) {
      let matchWord = processText(tw);

      let i = spokenWords.findIndex((w) => w == matchWord);
      let matched = i >= 0;

      if (matched) {
        spokenWords.splice(i, 1);
      }

      return {
        word: tw,
        matched: matched,
      };
    });

    setWords(targetWords);
    const matchedWords = targetWords.filter((w) => w.matched);
    setAccuracy(matchedWords.length / targetWords.length);
    setWpm(
      Math.round(
        (matchedWords.length / (Date.now() - startTime)) *
          MILLIS_PER_SECOND *
          SECONDS_PER_MINUTE
      )
    );

    if (targetWords.every((w) => w.matched)) {
      stop();
    }
  }, [combinedTranscript]);

  if (!countdown) {
    if (!playing) {
      return (
        <>
          <div className=" flex items-center justify-around"></div>
          <div className="min-h-screen bg-gray-50 flex flex-col justify-center relative overflow-hidden ">
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center relative overflow-hidden ">
              <h1 className="text-5xl p-4 text-center font-bold bg-gradient-to-r from-red-600 via-orange-600 to-blue-600 bg-clip-text text-transparent">
                Speech Racer
              </h1>

              <div className=" flex items-center justify-around">
                <button
                  onClick={() => play()}
                  className="rounded bg-indigo-600 text-white px-4 py-3 font-semibold text-lg leading-tight shadow-md hover:bg-indigo-700 "
                >
                  Play!
                </button>
              </div>
            </div>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="">
            <div className="flex items-center justify-around"></div>
            {/* Gradient border attributed to this blogpost: https://braydoncoyer.dev/blog/tailwind-gradients-how-to-make-a-glowing-gradient-background */}

            <div className="min-h-screen bg-gray-50 flex flex-col justify-center relative overflow-hidden sm:py-12">
              <h1 className="text-5xl p-4 text-center font-bold bg-gradient-to-r from-red-600 via-orange-600 to-blue-600 bg-clip-text text-transparent">
                Speech Racer
              </h1>
              <div className="max-w-sm md:max-w-lg mx-auto">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative px-7 py-6 bg-white ring-1 ring-gray-900/5 rounded leading-none flex items-top justify-start space-x-6">
                    <div className="space-y-2">
                      <div className="px-6 py-4">
                        <div className="text-xl mb-2">
                          {words.map((w, i) => (
                            <span
                              className={w.matched ? "matched" : ""}
                              key={i}
                            >
                              {w.word}{" "}
                            </span>
                          ))}
                        </div>
                        {!inChallenge ? <p className="text-gray-600 text-base">
                          {latestTranscript}
                        </p> : null}
                      </div>
                      {!inChallenge ? (
                        <div className="px-6">
                          <p className="text-gray-600 text-base"></p>WPM: {wpm},
                          Accuracy: {Math.round(accuracy * 100)}%, Duration:{" "}
                          {duration}s
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center justify-around self-center mt-6">
                <div className=" flex items-center justify-center"></div>
                <div className=" flex items-center justify-around">
                  {inChallenge ? (
                    <button
                      onClick={() => stop()}
                      className="rounded bg-indigo-600 text-white px-4 py-3 font-semibold text-lg leading-tight shadow-md hover:bg-indigo-700 "
                    >
                      Finish
                    </button>
                  ) : (
                    <button
                      onClick={() => startNewChallenge()}
                      className="text-white font-bold  py-2 px-4 rounded hover:shadow-lg flex items-center
              bg-gradient-to-r from-purple-500 via-red-500 to-yellow-500"
                    >
                      Next Challenge
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-center p-8">
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="button bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 mx-6 rounded hover:shadow-lg flex items-center"
                  href={`http://twitter.com/intent/tweet/?text=Slow down, Speech Racer! 🏎️💨 Try to beat my speechracer.com speed: ${wpm}. Built with @deepgramAI #speechracer`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    className="w-3.5 h-3.5 mr-2"
                  >
                    <path
                      fill="currentColor"
                      d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"
                    />
                  </svg>
                  Share
                </a>
              </div>
              <div className="flex gap-x-8 justify-center flex-wrap" style={{zIndex: 1}}>{/* Please forgive me.  So the footer doesn't cover the shadow. */}
                <button
                  className={"rounded bg-indigo-600 text-white px-4 py-3 font-semibold text-lg leading-tight shadow-md hover:bg-indigo-700  mt-2" + (category == "quotes" ? " selected" : "")}
                  onClick={clickedQuotes}
                >
                  Quotes
                </button>
                <button
                  className={"rounded bg-indigo-600 text-white px-4 py-3 font-semibold text-lg leading-tight shadow-md hover:bg-indigo-700  mt-2" + (category == "lyrics" ? " selected" : "")}
                  onClick={clickedLyrics}
                >
                  Lyrics
                </button>
                <button
                  className={"rounded bg-indigo-600 text-white px-4 py-3 font-semibold text-lg leading-tight shadow-md hover:bg-indigo-700 mt-2" + (category == "twisters" ? " selected" : "")}
                  onClick={clickedTongueTwisters}
                >
                  Tongue Twisters
                </button>
              </div>
              <Footer/>
            </div>
          </div>
        </>
      );
    }
  } else {
    return (
      <>
        <div className=" flex items-center justify-around"></div>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center relative overflow-hidden">
          <div className="min-h-screen bg-gray-50 flex flex-col justify-center relative overflow-hidden">
            <h1 className="text-5xl p-4 text-center font-bold bg-gradient-to-r from-red-600 via-orange-600 to-blue-600 bg-clip-text text-transparent">
              Get Ready!
            </h1>

            <div className=" flex items-center justify-around">
              <div className="font-bold text-3xl">{countdown}</div>
            </div>
          </div>
        </div>
      </>
    );
  }
}
