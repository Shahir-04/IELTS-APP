from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent.parent / 'public' / 'library'
root.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(root / 'a-little-every-day.pdf'), pagesize=(595, 790))

# Original practice material, intentionally independent of commercial IELTS books.
def text(x, y, content, size=12, font='Helvetica', color='#263e36'):
    pdf.setFillColor(HexColor(color)); pdf.setFont(font, size); pdf.drawString(x, y, content)

def header(part, topic, subtitle, track):
    text(48, 745, 'LILT  /  ORIGINAL PRACTICE SERIES', 9, 'Helvetica-Bold', '#829087')
    text(48, 697, part, 11, 'Helvetica-Bold', '#65846c')
    text(48, 661, topic, 28, 'Times-Bold')
    text(48, 634, subtitle, 11, 'Helvetica', '#718078')
    pdf.setFillColor(HexColor('#edf3e9')); pdf.roundRect(48, 563, 499, 43, 7, fill=1, stroke=0)
    text(63, 580, f'TRACK {track:02d}     Listen and complete the exercise below.', 11, 'Helvetica-Bold')
    pdf.setStrokeColor(HexColor('#e0e5dc')); pdf.line(48, 548, 547, 548)

def footer(number):
    text(48, 32, 'Small steps. Stronger English.', 9, 'Times-Italic', '#829087')
    text(515, 32, str(number), 10, 'Helvetica', '#829087'); pdf.showPage()

header('LISTENING  /  PART 1', 'A place to call home', 'Everyday conversations  /  Accommodation', 1)
text(48, 514, 'Questions 1-5', 16, 'Helvetica-Bold')
text(48, 488, 'Complete the notes below.', 12)
text(48, 466, 'Write ONE WORD AND/OR A NUMBER for each answer.', 10, 'Helvetica-Bold')
pdf.setFillColor(HexColor('#faf9f5')); pdf.roundRect(48, 182, 499, 258, 5, fill=1, stroke=0)
text(69, 407, 'RIVERSIDE STUDENT ACCOMMODATION', 12, 'Helvetica-Bold')
lines = ['Name of student:                     Alex Morgan', 'Length of stay:                        1 ........................ weeks', 'Preferred room:                      2 ........................ room', 'Weekly rent:                           3 £........................', 'Nearest transport:                  4 ........................ station', 'Move-in day:                          5 ........................']
for i, line in enumerate(lines): text(69, 370-i*31, line, 12)
text(48, 143, 'Before you listen', 12, 'Helvetica-Bold')
text(48, 119, 'Look at each gap. Do you expect a number, a place, or a day?', 11)
text(48, 97, 'Use the notes panel to keep your answers as you listen.', 11, 'Helvetica', '#718078')
footer(1)
header('LISTENING  /  PART 2', 'The neighbourhood tour', 'Following directions  /  Local facilities', 2)
text(48, 514, 'Questions 6-10', 16, 'Helvetica-Bold')
text(48, 488, 'Listen to the guide and complete the information.', 12)
questions = ['6. The library is opposite the ........................ .', '7. The park closes at ........................ in the evening.', '8. Students get a discount at the ........................ .', '9. The market takes place every ........................ .', '10. The guided walk lasts ........................ minutes.']
for i, line in enumerate(questions): text(48, 432-i*54, line, 13)
text(48, 112, 'Study tip', 12, 'Helvetica-Bold')
text(48, 88, 'Listen once for the overall meaning. Listen again for the details.', 11)
footer(2)
header('SPEAKING  /  PART 2', 'Somewhere you feel at home', 'Your turn to speak  /  1 minute to prepare, 2 minutes to talk', 3)
text(48, 510, 'Describe a place where you like to spend time.', 17, 'Times-Bold')
text(48, 466, 'You should say:', 12, 'Helvetica-Bold')
for i, line in enumerate(['where it is', 'what it looks like', 'what you usually do there', 'and explain why you enjoy spending time there.']): text(65, 430-i*35, '- '+line, 13)
text(48, 237, 'Make it your own', 13, 'Helvetica-Bold')
text(48, 208, 'Listen to the sample, then use the speaking recorder to practise.', 11)
text(48, 184, 'Try to include a specific memory and a reason for your choice.', 11)
text(48, 106, 'Reflect: Was your answer clear? Did you use a range of vocabulary?', 10)
footer(3)
pdf.save()
scripts = [
'Track one. A place to call home. Listen to a conversation about student accommodation. Hello, Riverside accommodation office. How can I help? Hello. My name is Alex Morgan, and I am looking for a room. Certainly. How long will you be staying? Twelve weeks, starting next month. And would you prefer a single or a shared room? A single room, please. We have one available for a hundred and eighty pounds a week. That sounds good. Is there public transport nearby? Yes. The railway station is just a five minute walk away. Excellent. When can I move in? Your room will be ready on Monday. Thank you, that is perfect. That is the end of track one.',
'Track two. The neighbourhood tour. Welcome to Riverside. Let me tell you about the local area. The library is opposite the museum, on the main road. If you enjoy being outdoors, the park is open until nine in the evening. For exercise, try the swimming pool. Students get a discount there with their student card. The outdoor market takes place every Saturday. You can buy fresh vegetables and local bread. Finally, join our guided walk to discover the area. It lasts forty five minutes. That is the end of track two.',
'Track three. Somewhere you feel at home. Here is a short sample answer. A place I really enjoy is a small park near my home. It has tall trees, a quiet pond, and a walking path around the edge. I usually go there in the morning before work. Sometimes I read on a bench, but mostly I just walk and listen to the birds. I like it because it gives me a chance to slow down. Last spring, I went there with my sister, and we spent the whole afternoon talking. That memory makes the place especially meaningful to me. Now it is your turn. Describe a place you enjoy.'
]
for i, script in enumerate(scripts, 1):
    source = root / f'track-{i:02d}.txt'; source.write_text(script)
    subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', f"flite=textfile={source}:voice=slt", '-ar', '22050', '-codec:a', 'libmp3lame', '-q:a', '5', str(root / f'track-{i:02d}.mp3')], check=True, capture_output=True)
