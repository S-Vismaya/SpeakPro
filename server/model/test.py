import contextlib
import io
import os
import re
import librosa
import soundfile as sf
from os import path
import openai
from openai import OpenAI
import pprint
import whisper_timestamped as whisper
from dotenv import load_dotenv
import sys
import time
import cv2
from gaze_tracking import GazeTracking
import math




load_dotenv()
ROOT_PATH = os.getenv('ROOT_PATH')
UPLOAD_PATH = os.getenv('UPLOAD_PATH')
mysp = __import__("my-voice-analysis")
AUDIO_FILE_DIR = rf"{ROOT_PATH}/audio_files"
TEMP_PATH = rf"{ROOT_PATH}/temp"
TEMP_FILE_NAME = "temp.wav"

def convert_audio_file(segment, sample_rate):
    y = segment * 32767 / max(abs(segment))
    y = y.astype('int16')
    sf.write(f"{TEMP_PATH}/{TEMP_FILE_NAME}", y, sample_rate, "PCM_24")

def analyze_segments(y, s, total_duration, segment_length_sec, analysis_type):
    ariculation_points = []
    pause_points = []
    for start_sec in range(int(total_duration - segment_length_sec + 1)):
        end_sec = start_sec + segment_length_sec
        segment = y[start_sec * s:end_sec * s]
        convert_audio_file(segment, s)

        with io.StringIO() as buf, contextlib.redirect_stdout(buf):
            mysp.mysptotal(TEMP_FILE_NAME[:-4], TEMP_PATH)
            captured_output = buf.getvalue()

        numbers = [float(num) for num in re.findall(r"\d+\.\d+|\d+", captured_output) if num != "0"]

        if analysis_type == "articulation_rate":
            metric = numbers[3] if len(numbers) >= 4 else None
            if metric <= 7.0 and metric >= 1.0:
                ariculation_points.append(metric)
        elif analysis_type == "pauses":
            metric = numbers[1] if len(numbers) >= 2 else None
            if metric <= 7.0 and metric >= 1.0:
                pause_points.append(metric)

        os.remove(rf"{TEMP_PATH}/{TEMP_FILE_NAME}")
        os.remove(rf"{TEMP_PATH}/temp.TextGrid")
    if analysis_type == "articulation_rate":
        print(ariculation_points)
    if analysis_type == "pauses":
        print(pause_points)
    return ariculation_points

def analyze_overall_balance_and_pauses(y, s):
    convert_audio_file(y, s)
    with io.StringIO() as buf, contextlib.redirect_stdout(buf):
        mysp.mysptotal(TEMP_FILE_NAME[:-4], TEMP_PATH)
        captured_output = buf.getvalue()

    numbers = [float(num) for num in re.findall(r"\d+\.\d+|\d+", captured_output) if num != "0"]
    balance = numbers[6] if len(numbers) >= 7 else None
    total_pauses = numbers[1] if len(numbers) >= 2 else None
    print(f"Overall Balance: {balance}")
    print(f"Total Number of Pauses: {total_pauses}")

    os.remove(rf"{TEMP_PATH}/{TEMP_FILE_NAME}")
    os.remove(rf"{TEMP_PATH}/temp.TextGrid")
    
    return balance, total_pauses

def analyze_audio_file(audio_file):
    y, s = librosa.load(f"{AUDIO_FILE_DIR}/{audio_file}", sr=44100)
    total_duration = len(y) / s

    # Analyzing for articulation rate in segments of 7 seconds
    art = analyze_segments(y, s, total_duration, 7, "articulation_rate")

    # Analyzing for pauses in segments of 3 seconds
    pau = analyze_segments(y, s, total_duration, 7, "pauses")

    # Analyzing for overall balance and total pauses
    balance, total_pauses = analyze_overall_balance_and_pauses(y, s)
    return balance, total_pauses

def time_stamped_data(audio, model_directory):

    # Specify the path to the model directory
    model = whisper.load_model("tiny", device="cpu", download_root=model_directory)


    result = whisper.transcribe(model, audio, verbose = True, language="en", initial_prompt = "please include all utterances including the ums and the ahs and repetitions and if a word is stuttered like stuttering is very important to capture like wa-waterbottle when i repeat the wa sound twice like st-story. When there is a prolonged pause can you put the word *pause* like this so we are aware.")

    def simplify_transcription(data):
        simplified = []
        full_text = ""
        for segment in data['segments']:
            for word in segment['words']:
                simplified.append([word['text'], [word['start'], word['end']]])
                full_text += word['text'] + " "
        return simplified, full_text.strip()

    simplified_data, full_transcription_text = simplify_transcription(result)

    print("Transcription: " + full_transcription_text)
    
    filtered_data = []
    repeated_words = []
    stutter_data = []
    like_data = []
    for i in range(len(simplified_data)):
        if "..." in simplified_data[i][0].lower() or "um" == simplified_data[i][0].lower() or "uh" == simplified_data[i][0].lower() or "uh," == simplified_data[i][0].lower() or "um," == simplified_data[i][0].lower() or "ah" == simplified_data[i][0].lower() or "yeah" in simplified_data[i][0].lower():
            filtered_data.append(simplified_data[i])
        if i > 0 and simplified_data[i][0] == simplified_data[i - 1][0]:
            repeated_words.append(simplified_data[i])
        if "-" in simplified_data[i][0]:
            stutter_data.append(simplified_data[i])
        if simplified_data[i][0] == "like" or simplified_data[i][0] == "like..." or simplified_data[i][0] == "like,":
            like_data.append(simplified_data[i])
            
    print(filtered_data)
    print(repeated_words)
    print(stutter_data)
    print(like_data)

    return len(filtered_data), len(repeated_words) * 2, len(stutter_data), len(like_data) * 2
    
def eye_tracking(video_path):    
    gaze = GazeTracking()
    video = cv2.VideoCapture(video_path)

    frame_counter = 0
    frame_skip = 16 # Adjust this to skip more or less frames
    results = []  # List to store results

    start_time = time.time()  # Start time
    run_duration = 8  # Run for 15 seconds

    while time.time() - start_time < run_duration:
    # We get a new frame from the video
        ret, frame = video.read()

        # Skip frames to achieve about 2 fps processing
        if not ret or frame_counter % frame_skip != 0:
            frame_counter += 1
            continue

        # We send this frame to GazeTracking to analyze it
        gaze.refresh(frame)

        blink = 1 if gaze.is_blinking() else 0
        direction = "right" if gaze.is_right() else "left" if gaze.is_left() else "center"
        text = "Blinking" if blink else "Looking " + direction

        # Store the result
        if text == "Looking left":
            results.append(1)
        elif text == "Looking center":
            results.append(0)
        elif text == "Looking right":
            results.append(1)
        else:
            results.append(0)
        
        frame_counter += 1

        # Close the video file or capturing device
    video.release()
    # Print the results
    score_pen = sum(results)/len(results)
    print(sum(results)/len(results))
    return score_pen

    
if __name__ == "__main__":
    balance, total_pauses = analyze_audio_file(sys.argv[1])
    balance_pen = abs(0.8 - balance) * 10
    pause_pen = total_pauses / 5
    filtered, repeat, stutter, like = time_stamped_data(f"{AUDIO_FILE_DIR}/{sys.argv[1]}", f"{ROOT_PATH}/whisper-timestamped")
    visual_pen = eye_tracking(f"{UPLOAD_PATH}/{sys.argv[2]}")

    visual_pen *= 100
    visual_pen = math.sqrt(visual_pen)
    score = 100 - filtered - repeat - stutter - like - balance_pen - pause_pen - visual_pen
    print(score)
    #print("before")
    #eye_tracking(f"{UPLOAD_PATH}/{sys.argv[2]}")
    #print("after")
    sys.stdout.flush()

