"use client";

import * as React from "react";
import { 
  UploadCloud, 
  FileVideo, 
  Music, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  ChevronDown, 
  Play, 
  Pause, 
  Scissors, 
  Info, 
  Trash2, 
  Library, 
  Upload, 
  Volume2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UploadStep = "idle" | "uploading" | "transcribing" | "transcribed" | "error";

export function IngestForm() {
  const [title, setTitle] = React.useState("");
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [step, setStep] = React.useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [projectId, setProjectId] = React.useState("");

  // BGM Source Tabs: "playlist" | "upload"
  const [bgmSource, setBgmSource] = React.useState<"playlist" | "upload">("playlist");

  // BGM Playlist Library States
  const [playlistTracks, setPlaylistTracks] = React.useState<string[]>([]);
  const [selectedBgm, setSelectedBgm] = React.useState("");

  // Preview and Trim States
  const [bgmStartOffset, setBgmStartOffset] = React.useState(0);
  const [bgmVolume, setBgmVolume] = React.useState(10); // default 10% volume
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [audioDuration, setAudioDuration] = React.useState(0);
  const [currentPlayTime, setCurrentPlayTime] = React.useState(0);
  const [audioSrc, setAudioSrc] = React.useState("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Synchronize browser preview audio element volume level
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume / 100;
    }
  }, [bgmVolume, audioSrc]);

  // Synchronize audio element src based on selectedBgm or audioFile
  React.useEffect(() => {
    // Stop playing
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }

    let src = "";
    if (bgmSource === "upload" && audioFile) {
      src = URL.createObjectURL(audioFile);
    } else if (bgmSource === "playlist" && selectedBgm) {
      src = `/bgm/${selectedBgm}`;
    }

    setAudioSrc(src);
    setBgmStartOffset(0);
    setCurrentPlayTime(0);

    // Cleanup previous object URLs
    return () => {
      if (src && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
  }, [selectedBgm, audioFile, bgmSource]);

  // Audio handlers
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const duration = e.currentTarget.duration;
    if (duration && !isNaN(duration)) {
      setAudioDuration(duration);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    setCurrentPlayTime(e.currentTarget.currentTime);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (!audioRef.current || !audioSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = bgmStartOffset;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error("BGM Playback failed:", err));
    }
  };

  const handleTrimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setBgmStartOffset(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      // If playing, sync the play position
      if (isPlaying) {
        audioRef.current.currentTime = val;
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return "00:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getCleanTitle = (filename: string) => {
    return filename
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[_-]/g, " ")     // Replace underscores and hyphens with spaces
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize words
      .join(" ");
  };

  const getGradientForTrack = (filename: string) => {
    const gradients = [
      "from-violet-600 to-indigo-900",
      "from-emerald-500 to-teal-800",
      "from-blue-600 to-purple-800",
      "from-amber-500 to-rose-700",
      "from-pink-500 to-rose-900",
      "from-cyan-500 to-blue-800",
      "from-fuchsia-600 to-pink-850",
      "from-orange-500 to-red-800"
    ];
    let sum = 0;
    for (let i = 0; i < filename.length; i++) {
      sum += filename.charCodeAt(i);
    }
    const idx = sum % gradients.length;
    return gradients[idx];
  };

  React.useEffect(() => {
    const fetchBgmPlaylist = async () => {
      try {
        const res = await fetch("/api/bgm");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPlaylistTracks(data.tracks || []);
          }
        }
      } catch (err) {
        console.error("Failed to query BGM playlist:", err);
      }
    };
    fetchBgmPlaylist();
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
      }
    }
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("audio/")) {
        setAudioFile(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !videoFile) {
      setErrorMessage("Please supply a project title and drop an MP4 video.");
      return;
    }

    setErrorMessage("");
    setStep("uploading");

    try {
      // 1. Upload files to /api/upload
      const formData = new FormData();
      formData.append("title", title);
      formData.append("video", videoFile);
      
      if (bgmSource === "upload" && audioFile) {
        formData.append("audio", audioFile);
      } else if (bgmSource === "playlist" && selectedBgm && selectedBgm.trim().length > 0) {
        formData.append("selectedBgm", selectedBgm);
      }

      if (bgmStartOffset > 0) {
        formData.append("bgmStartOffset", bgmStartOffset.toString());
      }

      formData.append("bgmVolume", bgmVolume.toString());

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Failed to ingest files.");
      }

      const uploadResult = await uploadRes.json();
      const pId = uploadResult.project.id;
      setProjectId(pId);

      // 2. Trigger Deepgram transcription
      setStep("transcribing");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: pId }),
      });

      if (!transcribeRes.ok) {
        const errData = await transcribeRes.json();
        throw new Error(errData.error || "Failed transcription.");
      }

      setStep("transcribed");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Something went wrong.");
      setStep("error");
    }
  };

  const resetForm = () => {
    setTitle("");
    setVideoFile(null);
    setAudioFile(null);
    setSelectedBgm("");
    setBgmStartOffset(0);
    setBgmVolume(10);
    setBgmSource("playlist");
    setStep("idle");
    setErrorMessage("");
    setProjectId("");
  };

  return (
    <Card className="relative overflow-hidden w-full">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
      <CardHeader>
        <CardTitle className="text-base font-bold">New Project Ingestion</CardTitle>
        <CardDescription className="text-xs">
          Ingest raw video and background audio locally, and auto-transcribe with timestamps.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {step === "idle" || step === "error" ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-2">
              <label htmlFor="project-title" className="text-xs font-semibold text-zinc-300">Project Title</label>
              <Input
                id="project-title"
                type="text"
                placeholder="e.g. Hormozi Style Reels #01"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Video Dropzone */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-300">Video Ingest (MP4)*</span>
              <div
                onDragOver={handleDragOver}
                onDrop={handleVideoDrop}
                className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all duration-300 ${
                  videoFile 
                    ? "border-white/40 bg-zinc-950/60" 
                    : "border-zinc-800 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-950/40"
                }`}
                onClick={() => document.getElementById("video-input")?.click()}
              >
                <input
                  id="video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoChange}
                />
                {videoFile ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                      <FileVideo className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white truncate max-w-[280px]">
                        {videoFile.name}
                      </p>
                      <span className="text-[10px] text-zinc-500">
                        {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-semibold text-white">Drag & drop MP4 video here</p>
                      <p className="text-[10px] text-zinc-500">or click to browse local files</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Background Music (BGM) Integrator Section */}
            <div className="space-y-4 pt-2 border-t border-[#121222]/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Background Music (BGM - Optional)</span>
                {/* Tab Switchers */}
                <div className="flex bg-[#07070c] p-0.5 rounded-lg border border-[#121222] text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setBgmSource("playlist");
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${
                      bgmSource === "playlist"
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Library className="h-3 w-3" />
                    <span>Local Playlist</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBgmSource("upload");
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${
                      bgmSource === "upload"
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Upload className="h-3 w-3" />
                    <span>Custom Upload</span>
                  </button>
                </div>
              </div>

              {/* Source Tab 1: Local Playlist */}
              {bgmSource === "playlist" && (
                <div className="space-y-3">
                  {playlistTracks.length > 0 ? (
                    <div className="max-h-[260px] overflow-y-auto pr-1.5 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {playlistTracks.map((track) => {
                          const isSelected = selectedBgm === track;
                          const coverGradient = getGradientForTrack(track);
                          const cleanTitle = getCleanTitle(track);
                          const extension = track.split(".").pop() || "mp3";

                          return (
                            <div
                              key={track}
                              onClick={() => setSelectedBgm(isSelected ? "" : track)}
                              className={`group relative flex items-center space-x-3 p-2.5 rounded-xl border transition-all duration-300 cursor-pointer select-none ${
                                isSelected
                                  ? "border-violet-500/80 bg-violet-600/10 shadow-[0_0_15px_rgba(139,92,246,0.12)]"
                                  : "border-[#151525] bg-[#0c0c16]/40 hover:bg-[#0c0c16]/80 hover:border-zinc-700"
                              }`}
                            >
                              {/* Music Wallpaper / Cover Art */}
                              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${coverGradient} flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner group-hover:scale-[1.03] transition-transform duration-300`}>
                                {/* Abstract background vinyl record overlay for that organic music feel */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:4px_4px] opacity-40" />
                                <div className="absolute w-6 h-6 rounded-full border border-white/10 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                  <Music className="h-3 w-3 text-white" />
                                </div>
                                {/* Active subtle border glow on cover art */}
                                {isSelected && (
                                  <div className="absolute inset-0 bg-violet-500/10 border border-violet-400/30 animate-pulse" />
                                )}
                              </div>

                              {/* Title & Metadata */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate transition-colors ${
                                  isSelected ? "text-violet-300" : "text-zinc-200 group-hover:text-white"
                                }`}>
                                  {cleanTitle}
                                </p>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className="text-[8px] bg-zinc-900 text-zinc-500 font-bold px-1.5 py-0.5 rounded border border-zinc-800 uppercase">
                                    {extension}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[8px] font-bold text-violet-400">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Active selection indicator */}
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                                isSelected
                                  ? "border-violet-500 bg-violet-500 text-white"
                                  : "border-zinc-800 bg-[#07070c]"
                              }`}>
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-xl bg-zinc-950/40 border border-zinc-900 border-dashed text-xs text-zinc-500 font-medium">
                      <Music className="h-7 w-7 text-zinc-700 mx-auto mb-2" />
                      <span>No background music files found in local playlist.</span>
                      <p className="text-[10px] text-zinc-600 mt-1 max-w-[280px] mx-auto">
                        Paste MP3 songs directly into <code className="text-zinc-400">public/bgm</code> to populate your local selection.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source Tab 2: Custom MP3 Upload */}
              {bgmSource === "upload" && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleAudioDrop}
                  className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center space-y-2.5 cursor-pointer transition-all duration-300 ${
                    audioFile 
                      ? "border-white/30 bg-zinc-950/60" 
                      : "border-zinc-800 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-950/40"
                  }`}
                  onClick={() => document.getElementById("audio-input")?.click()}
                >
                  <input
                    id="audio-input"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioChange}
                  />
                  {audioFile ? (
                    <>
                      <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center text-zinc-300">
                        <Music className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-100 truncate max-w-[280px]">
                          {audioFile.name}
                        </p>
                        <span className="text-[9px] text-zinc-500">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-9 w-9 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                        <Music className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-center space-y-0.5">
                        <p className="text-xs text-zinc-300">Drag & drop background MP3 here</p>
                        <p className="text-[9px] text-zinc-500">or click to browse local folders</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Hidden/Helper HTML5 Audio Element for playback state syncer */}
              {audioSrc && (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
              )}

              {/* High-Polish Preview & Trim Audio Panel */}
              {audioSrc && (
                <div className="p-4 rounded-xl bg-gradient-to-b from-[#0c0c16]/80 to-[#07070c]/90 border border-[#1c1c35]/50 backdrop-blur-md space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.3)] animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="h-8 w-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                        <Music className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]" title={selectedBgm || audioFile?.name}>
                          {selectedBgm || audioFile?.name}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">
                          {formatTime(audioDuration)} Total Length
                        </p>
                      </div>
                    </div>
                    {/* Duck Badge */}
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-500/20 animate-pulse">
                      Mixed at {bgmVolume}% Vol
                    </span>
                  </div>

                  {/* Play & Preview Progress Bar */}
                  <div className="flex items-center space-x-3.5 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/50">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="h-8 w-8 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center focus:outline-none transition-all duration-200 hover:scale-105 shrink-0 shadow-md animate-glow"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 fill-current translate-x-[1px]" />
                      )}
                    </button>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold font-mono">
                        <span>{formatTime(currentPlayTime)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                      {/* Simple visual progress line */}
                      <div className="relative w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-violet-500 transition-all duration-100"
                          style={{
                            width: `${audioDuration > 0 ? (currentPlayTime / audioDuration) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trim Controller block */}
                  <div className="space-y-2 pt-1.5 border-t border-[#121222]/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
                        <Scissors className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        <span>Trim BGM Start Offset</span>
                      </div>
                      <span className="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                        Starts at {formatTime(bgmStartOffset)}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={audioDuration || 180}
                      step={1}
                      value={bgmStartOffset}
                      onChange={handleTrimChange}
                      className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-violet-500 focus:outline-none"
                    />

                    <div className="flex items-center space-x-1.5 text-[9px] text-zinc-500 bg-zinc-950/20 p-2 rounded border border-zinc-900/40">
                      <Info className="h-3 w-3 text-violet-400 shrink-0" />
                      <span>
                        FFmpeg will trim the BGM to start playing from this point, then overlay it with the video from the very beginning.
                      </span>
                    </div>
                  </div>

                  {/* Volume Controller block */}
                  <div className="space-y-2 pt-1.5 border-t border-[#121222]/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
                        <Volume2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        <span>Background Music Volume</span>
                      </div>
                      <span className="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                        {bgmVolume}% Volume
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={bgmVolume}
                      onChange={(e) => setBgmVolume(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-violet-500 focus:outline-none"
                    />

                    <div className="flex items-center space-x-1.5 text-[9px] text-zinc-500 bg-zinc-950/20 p-2 rounded border border-zinc-900/40">
                      <Info className="h-3 w-3 text-violet-400 shrink-0" />
                      <span>
                        Adjust background music volume level. Lower volume is highly recommended to make voiceovers crystal-clear.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full font-semibold">
              Ingest & Transcribe Video
            </Button>
          </form>
        ) : step === "uploading" || step === "transcribing" ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
            <p className="text-xs text-zinc-400">
              {step === "uploading" ? "Uploading & mixing BGM…" : "Transcribing…"}
            </p>
          </div>
        ) : step === "transcribed" ? (
          <div className="flex flex-col items-center py-12 space-y-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm text-zinc-400 text-center">
              Transcript ready. Continue in Projects to render and upload to R2.
            </p>
            <Button
              className="w-full"
              onClick={() => (window.location.href = `/projects/${projectId}`)}
            >
              Open project editor
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full" onClick={resetForm}>
              Ingest another
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
