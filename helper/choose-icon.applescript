-- choose-icon: the system's own file dialog for a project's tab icon.
-- Run by the project-tabs mod as: osascript choose-icon.applescript "<prompt>"
-- Prints the chosen file's path; a cancelled dialog exits with -128.

on run argv
	tell me to activate
	return POSIX path of (choose file with prompt (item 1 of argv) of type {"public.image", "public.svg-image"})
end run
